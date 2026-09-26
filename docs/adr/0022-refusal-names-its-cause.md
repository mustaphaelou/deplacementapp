# ADR 0022: A refusal names its cause — the engine's codes, the preserved unknown code, the refusal log

**Date:** 2026-09-26

**Status:** Accepted

## Context

ADR-0017 made a refused ConnexionGoogle **visible**: the gate returns a coded refusal, the engine redirects to `/login?error=<code>&error_description=<message>`, and the login page renders a French message per code from one home. What it did not settle is what happens when the failure is **not** the gate's — a condition Google or the deployment owns. Two facts made those failures invisible:

1. **`googleRefusalMessage` collapsed every unknown code into one string.** Only the gate's three codes were mapped. The engine's own vocabulary — `invalid_code`, `state_mismatch`, `state_not_found`, `unable_to_get_user_info`, … — and Google's forwarded `access_denied` were entirely unmapped, so an infrastructure failure and a bug in the app rendered identically.
2. **The failing code was destroyed before it could be read.** `googleRefusalFromSearch` read it once at mount and `stripRefusalParams` then `history.replaceState`'d it away. The "no zombie parameter" rule is right for a *known* refusal, whose message is already on screen; it is wrong for an *unknown* code — the one moment the code carries the diagnosis.

Reproduced live on 2026-09-26 against the production deployment: a Google consent-screen rejection (`access_denied` — the consent screen is in *Testing* and the signing-in address is not a test user) presented as the generic `GOOGLE_REFUSAL_FALLBACK_MESSAGE`. Diagnosing it required probing the deployment by hand; nothing the user or the operator could see pointed at Google. The server was healthy throughout: `BETTER_AUTH_URL` produced the correct `redirect_uri` and the `__Secure-better-auth.state` cookie round-tripped.

A third fact surfaced while implementing, and is why this ADR is larger than the fix: **the codes the login page can name are not the codes the engine sends.** The engine honours `errorCallbackURL` only once the OAuth state has parsed (`redirectOnError(errorURL ?? defaultErrorURL, …)`). A failure *before* that — a state cookie that never came back, a second sign-in in another tab consuming the state, a callback with no `state` at all — goes to `onAPIError.errorURL`, which the app never set. The engine then fell back to `${baseURL}/error`, its own error page, which in production redirects to `/?error=…` — the application home. Verified against the installed 1.7.4: `state_not_found` and `state_mismatch` landed on `http://localhost:3000/api/auth/error?error=…`, so a mapping for them alone would have been unreachable code.

## Decision

**Four surfaces, one rule: a refusal always names its cause, and the raw code is never lost.**

1. **Every refusal reaches the login page.** `onAPIError: { errorURL: "/login" }` on the auth instance (`lib/auth/better-auth.ts`) makes the pre-state refusals resolve to the same surface as the post-state ones, instead of to the engine's error page or — in production — the app home. Without it, two of the five mapped messages could never be rendered by anyone.
2. **The engine's Google-side codes get their own French messages** (`GOOGLE_ENGINE_REFUSAL_MESSAGES`, `lib/auth/google-refusals.ts`), beside the gate's three and distinct from them: `access_denied` names the refused authorization (the live consent-screen case); `invalid_code`, `state_mismatch` and `state_not_found` say the OAuth round trip did not complete and to retry; `invalid_callback_request` names a misconfigured callback and points at the administrateur. The generic fallback is kept for codes outside the mapped set — but it is no longer the *only* thing a user can see. Their **provenance is recorded per code**, because it differs: `access_denied` is Google's own OAuth code, forwarded verbatim by the engine's callback and belonging to no engine list; the rest are read from the installed distribution (`dist/oauth2/errors.mjs`, `dist/state.mjs`, `dist/api/routes/callback.mjs`).
3. **The zombie-parameter rule keys on whether the code was rendered.** `stripRefusalParams` still strips a code the app has a message for (its message is on screen; the parameter is noise), and still strips an orphan `error_description`. A code with **no** message stays in the URL, with its description and every other parameter: the fallback message names nothing, and destroying the parameter at mount would leave the only diagnostic artefact unrecoverable without a live probe. The cost is deliberate — a refresh re-renders the fallback alert rather than a clean page.
4. **Every refusal is logged server-side, mapped or not** (`lib/auth/refusal-log.ts`, wrapped around the auth handler in `app/api/auth/[...all]/route.ts`): one `console.warn` carrying `{ code, error_description }` verbatim. The log is observability, not contract — a throwing sink cannot turn a refusal's 302 into a 500.
5. **The raw code is rendered in the UI only outside production**, in the refusal alert, behind a `data-refusal-code` hook. `process.env.NODE_ENV` is inlined at build time, so the production bundle carries no debug line at all.

## Rationale

- **A refusal message is support tooling; a generic one is a dead end.** ADR-0017 already accepted per-reason messages on the grounds that reaching a refusal requires controlling a Google account at that exact address, so the administrator is the audience. That argument is stronger, not weaker, for the codes the administrator must act on in the Google console.
- **A message nobody can reach is not a message.** Mapping codes the engine never sends to this page is the quiet half-failure: the copy reads well in a unit test and no user ever sees it. The redirect target is therefore part of the contract, asserted at the callback seam against the real engine rather than assumed.
- **The code is the evidence, and evidence is destroyed by a tidy-up rule.** "No zombie parameter" is UI hygiene; applying it to the one artifact that carries the diagnosis trades a real diagnostic for a cosmetic refresh. The rule survives where it is earned.
- **A log line is the cheapest possible diagnosis.** The alternative is reproducing the failure against the live deployment, which is exactly what #247 was written up from.
- **Pin, don't track — and say which codes are pinned.** The engine's list is not a public API, so `lib/auth/google-refusals.test.ts` re-reads the installed distribution and fails when a code this map names is no longer emitted. `access_denied` is deliberately outside that pin: it is Google's, relayed by the engine, and the set of codes Google may send is open. Claiming it was pinned would be false, so the map documents it as a passthrough instead.

## Consequences

- `lib/auth/google-refusals.ts` carries two vocabularies — the gate's (`GOOGLE_REFUSAL_CODES`, still the only codes the gate may return) and the engine's (read-only for the app) — plus `isMappedGoogleRefusalCode`, the predicate the strip rule keys on.
- The auth instance now sets `onAPIError.errorURL`. It affects every engine error redirect, which is the intent: a refusal is a user-facing French message, not an HTML error page.
- The strip rule is no longer "a refusal arrived" but "a message was rendered". Both directions are pinned.
- Every OAuth refusal costs one `console.warn`; a deployment with a broken Google configuration logs a line per attempt rather than one per diagnosis.
- The engine's code list is pinned to 1.7.4. An upgrade that renames or drops a code reverts that code to the generic message — **and fails `google-refusals.test.ts`**, which is the intended signal.
- Tests: the engine vocabulary, the pin against the installed engine and the unknown-code fallback (`app/(auth)/login/page.test.tsx` through the exported pure functions — vitest runs `environment: node` and never runs effects, so the strip rule is exercised directly); the raw code in the UI in development and in production; the log seam in isolation (`lib/auth/refusal-log.test.ts`), on the route's own `GET`/`POST` (`app/api/auth/[...all]/route.test.ts`), and against the real engine's redirects including the pre-state ones (`lib/auth/google-callback.test.ts`).

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors, 3 pre-existing `no-img-element` warnings.
- `npm test` — **752 passed, 8 skipped, 76 files**.
- **Regression tests proven to bite**, by reverting each mechanism in turn from a green baseline: the strip rule (43 failures), the engine vocabulary (14), the refusal log (8), the `onAPIError.errorURL` redirect target (2), the route wiring (2).
- The callback-seam suite runs the whole Google dance against the real engine over PGlite, so the log and the redirect targets are asserted on responses the engine actually produces.
- A manual pass with real Google credentials on a configured deployment is still required before merge: the suite simulates the provider and cannot reproduce Google's consent screen.
