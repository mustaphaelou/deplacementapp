# ADR 0017: Repair Google sign-in — validateUserInfo gate, attested-email linking, visible refusals

**Date:** 2026-09-11

**Status:** Accepted

## Context

ADR-0016 migrated authentication to Better Auth and left one requirement open: the Google gate (only an existing, active Utilisateur with Google enabled may sign in) had to be re-implemented with parity, its exact mechanism to be verified against the docs at implementation time. It was not: the veto shipped as a throwing `mapProfileToUser`, and account linking was left at defaults. Two verified defects made Google sign-in unusable as shipped:

1. **No Google sign-in can complete.** A first sign-in must implicitly link the Google identity to the existing Utilisateur. Better Auth gates implicit linking on the local row's `emailVerified` (default requirement `true` — an anti-takeover default), and no code path ever set that flag: it defaulted to `false` and was never written. Every attempt ended in `account_not_linked`; in production the user was silently returned to the login page.
2. **Refusals dead-end.** The veto threw inside `mapProfileToUser`, which Better Auth calls from `getUserInfo()` — outside the OAuth callback's error handling. A refused browser received a raw JSON `403 {"message":"…"}`, with no redirect and no user-readable message.

Better Auth 1.7.x ships `user.validateUserInfo` — the documented hook for exactly this gate. It runs before a user is created, an account is linked, or a returning user signs in, and rejections become a clean `?error=<code>&error_description=<message>` redirect. It does not exist in 1.6.23.

## Decision

1. **Upgrade to Better Auth 1.7.x** (`better-auth` + `@better-auth/drizzle-adapter`, 1.6.23 → 1.7.4) and align account identity with what 1.7.4 actually requires: credential accounts re-keyed from the sign-in e-mail to the Utilisateur's stable `id` — 1.7.4's credential sign-in resolves the row by `providerId = "credential" AND accountId = user.id` — plus a unique `(providerId, accountId)` index (`account_providerId_accountId_unique`), the pair the engine recognizes an external account by. `setPassword` keys credential rows on the Utilisateur id from now on.
   The account schema gains **no `issuer` column**. The required `issuer` column and unique `(issuer, accountId)` index existed only in Better Auth **1.7.0–1.7.2**; 1.7.3 removed that requirement, and accounts are again recognized by `providerId` + `accountId`, as in 1.6 (1.7 upgrade guide, "Account identity keeps the provider key" — `better-auth.com/docs/guides/1-7-upgrade-guide`). The issuer model was deliberately not adopted — an unused required column breaks every account insert.
2. **The Google gate is implemented as `user.validateUserInfo`** (`lib/auth/google-guard.ts`): every action (`create-user`, `link-account`, `sign-in`) refuses an identity that is not an existing, active, Google-enabled Utilisateur, before any session is issued. Refusals are **returned** (`{ error, errorDescription }`), never thrown — a throw collapses into the engine's generic `validation_failed` and loses the code. Refusal codes: `utilisateur_introuvable`, `utilisateur_desactive`, `google_non_active`; the e-mail match is case-insensitive.
3. **`emailVerified` becomes a real fact** (the attestation): set `true` at provisioning for every Utilisateur — including the amorçage first user (`UtilisateurService.create`, `quitterAmorcage`) — and backfilled for all existing rows by migration `0007_attestation_email_verified`. The administrator's provisioning act is the attestation: no self-service ritual, no new control. Better Auth's linking gate keeps its default; the deprecated `requireLocalEmailVerified` escape hatch is not used.
4. **The sign-in request carries `requestSignUp: true` while `disableImplicitSignUp` stays `true`**: an unknown address must reach the gate — where the closed pool refuses it with `utilisateur_introuvable` — instead of short-circuiting to the engine's `signup_disabled`. Nothing auto-provisions: the gate runs before the user insert and refuses every unknown identity.
5. **Refusals are visible**: the web client passes `errorCallbackURL: "/login"`; the login page renders a French message per refusal code from one home (`lib/auth/google-refusals.ts`), with a generic fallback for engine codes, and strips the `error` / `error_description` parameters after rendering so a refresh shows a clean page. The Google section renders only when the deployment has Google credentials configured (`connexionGoogle`, computed from `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`, exposed by the public `/api/setup/status`).
6. **Sign-in stays closed-pool**: enabling Google stays a per-Utilisateur administrator act; turning Google off blocks future Google sign-ins but does not revoke live sessions — account-level access remains governed by `actif` (unchanged semantics).

## Rationale

- **Official mechanism over an accidental one.** The throw happened to block sessions, but it bypassed Better Auth's error routing and was undocumented behaviour. `validateUserInfo` is the supported contract and yields stable refusal codes.
- **The flag must mean something.** This app has no self-service email verification; provisioning by an administrator is the attestation. Making `emailVerified` true at provisioning repairs linking today and keeps working as the linking gate tightens in future releases.
- **Visible refusals are support tooling.** Reaching a refusal requires controlling a Google account at that exact address; per-reason messages cost nothing and spare the administrator guesswork.
- **Upgrade now is the cheapest it will ever be.** Because defect 1 has prevented all linking, there are zero Google accounts to migrate — the account-identity work touches only credential rows.

## Consequences

- One-time migrations ship with the package bump: `0006_rekey_credential_accounts` (credential re-key + the unique identity index) and `0007_attestation_email_verified` (backfill). The session cookie scheme is unchanged across the upgrade (same signing, same cookie names), so existing sessions are expected to survive — pinned by the session round-trip test on the new engine.
- A refused sign-in redirects to `/login?error=<code>` with a readable French message; previously it was raw JSON (refusals) or an unexplained bounce (linking failure).
- First successful Google sign-in links the account and issues a session; returning sign-ins revalidate existence, activity and enablement on every attempt.
- Turning Google off for a Utilisateur blocks future Google sign-ins but does not revoke live sessions (unchanged semantics).
- **Known limitation** (observed at the callback seam): the gate matches e-mails case-insensitively, but the engine's own user-by-e-mail lookup is not — a *first-time* link for a stored e-mail that is not already lowercase falls into the engine's create path and fails closed with an engine code (`unable_to_create_user`, rendered as the generic fallback message). Returning sign-ins are unaffected. Stored-e-mail normalization was out of scope.
- ADR-0016's open re-verification risk ("Google gating is the main behavioral risk") is closed.

## Verification

- **Callback-seam regression suite** (`lib/auth/google-callback.test.ts`): drives the whole Google dance against the real auth instance over PGlite — OAuth state minted through the engine's sign-in endpoint, the Google token exchange stubbed at the network boundary, a synthetic `id_token`. Covered: an enabled Utilisateur links and receives a session; a returning sign-in does not duplicate the link; a Utilisateur provisioned through the real service path links (never `account_not_linked`, and the attestation is asserted as provisioning's own write); unknown / deactivated / not-enabled identities each redirect with the right code and leave no session; refusals leave the database unchanged.
- **Gate unit coverage** (`lib/auth/better-auth.test.ts`): refusal codes with non-empty descriptions, the case-insensitive e-mail match, pass-through of non-Google sources, and the closed pool rejecting self sign-up.
- **Seeded migration tests** (same file): `0006_rekey_credential_accounts` re-keys a legacy e-mail-keyed credential row onto the Utilisateur id, creates the unique identity index, and the migrated database still signs the Utilisateur in with the legacy bcrypt hash; `0007_attestation_email_verified` backfills pre-existing rows without touching identities.
- **Login surface render suite** (`app/(auth)/login/page.test.tsx`): per-code message mapping and engine-code fallback, the rendered alert, parameter stripping (no zombie parameter), and the conditional Google section; `app/api/setup/status/route.test.ts` pins `connexionGoogle` from the credential pair.
- The full gate (typecheck / lint / test) is green on the branch; a manual pass with real Google credentials on a configured deployment remains required before merge — the suite simulates the provider and cannot prove the Google consent flow itself.
