# ADR 0022: A refusal names its cause — the engine's codes, the preserved unknown code, the refusal log

**Date:** 2026-09-26

**Status:** Accepted

## Context

ADR-0017 made a refused ConnexionGoogle **visible**: the gate returns a coded refusal, the engine redirects to `/login?error=<code>&error_description=<message>`, and the login page renders a French message per code from one home. What it did not settle is what happens when the failure is **not** the gate's — a condition Google or the deployment owns. Two facts made those failures invisible:

1. **`googleRefusalMessage` collapsed every unknown code into one string.** Only the gate's three codes were mapped. The engine's own vocabulary — `access_denied`, `invalid_code`, `state_mismatch`, `state_not_found`, `invalid_callback_request`, `unable_to_get_user_info`, … — was entirely unmapped, so an infrastructure failure and a bug in the app rendered identically.
2. **The failing code was destroyed before it could be read.** `googleRefusalFromSearch` read it once at mount and `stripRefusalParams` then `history.replaceState`'d it away. The "no zombie parameter" rule is right for a *known* refusal, whose message is already on screen; it is wrong for an *unknown* code — the one moment the code carries the diagnosis.

Reproduced live on 2026-09-26 against the production deployment: a Google consent-screen rejection (`access_denied` — the consent screen is in *Testing* and the signing-in address is not a test user) presented as the generic `GOOGLE_REFUSAL_FALLBACK_MESSAGE`. Diagnosing it required probing the deployment by hand; nothing the user or the operator could see pointed at Google. The server was healthy throughout: `BETTER_AUTH_URL` produced the correct `redirect_uri`, the `__Secure-better-auth.state` cookie round-tripped, and the callback route returned real engine codes for a bad code and a missing state.

The engine's code list is **not** a stable public API. It is read from the installed 1.7.4 (`dist/oauth2/errors.mjs`, `dist/api/routes/callback.mjs`, `dist/state.mjs`) and pinned by tests, so an upgrade that renames a code fails loudly rather than silently reverting to the generic message.

## Decision

**Three surfaces, one rule: a refusal always names its cause, and the raw code is never lost.**

1. **The engine's Google-side codes get their own French messages** (`GOOGLE_ENGINE_REFUSAL_MESSAGES`, `lib/auth/google-refusals.ts`), beside the gate's three and distinct from them: `access_denied` names the refused authorization (the live consent-screen case); `invalid_code`, `state_mismatch` and `state_not_found` say the OAuth round trip did not complete and to retry; `invalid_callback_request` names a misconfigured callback and points at the administrateur. The generic fallback is kept for codes outside the pinned set — but it is no longer the *only* thing a user can see.
2. **The zombie-parameter rule keys on whether the code was rendered.** `stripRefusalParams` still strips a code the app has a message for (its message is on screen; the parameter is noise), and still strips an orphan `error_description`. A code with **no** message stays in the URL: the fallback message names nothing, and destroying the parameter at mount would leave the only diagnostic artefact unrecoverable without a live probe. The cost is deliberate — a refresh re-renders the fallback alert rather than a clean page.
3. **Every refusal is logged server-side, mapped or not** (`lib/auth/refusal-log.ts`, wrapped around the auth handler in `app/api/auth/[...all]/route.ts`): one `console.warn` carrying `{ code, error_description }` verbatim. Every OAuth failure leaves through that one route as a redirect, so a wiring the engine's redirect shape never reaches would have been caught by the callback-seam test rather than by production. The log is observability, not contract: a throwing sink cannot turn a refusal's 302 into a 500.
4. **The raw code is rendered in the UI only outside production**, in the refusal alert, so a developer reads `access_denied` verbatim while an end user keeps the French copy. `process.env.NODE_ENV` is inlined at build time, so the production bundle carries no debug line at all.

## Rationale

- **A refusal message is support tooling; a generic one is a dead end.** ADR-0017 already accepted per-reason messages on the grounds that reaching a refusal requires controlling a Google account at that exact address, so the administrator is the audience. That argument is stronger, not weaker, for the codes the administrator must act on in the Google console.
- **The code is the evidence, and evidence is destroyed by a tidy-up rule.** "No zombie parameter" is a UI-hygiene rule; applying it to the one artifact that carries the diagnosis trades a real diagnostic for a cosmetic refresh. The rule survives where it is earned.
- **A log line is the cheapest possible diagnosis.** The alternative to the log is reproducing the failure against the live deployment, which is exactly what #247 was written up from.
- **Pin, don't track.** The engine's codes are read from the installed version and pinned by tests. A future rename shows up as a failing test that says which code lost its message, instead of a silent fall back to "sign-in failed".

## Consequences

- `lib/auth/google-refusals.ts` now carries two vocabularies — the gate's (`GOOGLE_REFUSAL_CODES`, still the only codes the gate may return) and the engine's (`GOOGLE_ENGINE_REFUSAL_MESSAGES`, read-only for the app) — plus `isMappedGoogleRefusalCode`, the predicate the strip rule now keys on.
- The strip rule is no longer "a refusal arrived" but "a message was rendered". Both directions are pinned: a mapped code is stripped, an unmapped one survives.
- Every OAuth refusal costs one `console.warn`. A deployment with a broken Google configuration therefore logs a line per attempt rather than one per diagnosis.
- The engine's code list is pinned to 1.7.4. An upgrade that renames or drops a code reverts that code to the generic message — **and fails the tests**, which is the intended signal.
- Tests: the engine vocabulary and the unknown-code fallback (`app/(auth)/login/page.test.tsx`, through the exported pure functions — vitest runs `environment: node` and never runs effects, so the strip rule is exercised directly, not through a mounted component); the raw code in the UI in development and in production; the log seam in isolation (`lib/auth/refusal-log.test.ts`) and against the real engine's own redirects (`lib/auth/google-callback.test.ts`, which is what proves the wiring).

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors, 3 pre-existing `no-img-element` warnings.
- `npm test` — **737 passed, 8 skipped, 74 files** (73 passed + 1 skipped file).
- **Regression tests proven to bite**: reverting the strip rule, the engine vocabulary and the log each fails the tests written for them (16 failures across the three), restored afterwards.
- The callback-seam suite runs the whole Google dance against the real engine over PGlite, so the log is asserted on redirects the engine actually produces — including `unable_to_get_user_info`, a code the app does not map.
- A manual pass with real Google credentials on a configured deployment is still required before merge: the suite simulates the provider and cannot reproduce Google's consent screen.
