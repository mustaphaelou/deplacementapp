# ADR 0009: Reify Amorçage as a lifecycle-state module with an atomic bootstrap

**Date:** 2026-07-29

**Status:** Accepted

## Context

`CONTEXT.md` defines **Amorçage** as the bootstrap lifecycle state of the system — detected by counting Societes, not a persistent entity. While in Amorçage, the login page renders a setup wizard instead of the sign-in form; the wizard creates the initial Societe, Departements, and first Utilisateur, after which the system leaves Amorçage permanently.

Before this ADR, the architecture had three problems:

1. **No code module.** The architecture report's Candidate 3 noted that Amorçage existed only as an implicit state — the count gate (`SELECT COUNT(*) FROM societes`) was inlined at two API routes (`/api/setup/register` and `/api/setup/status`), and the bootstrap logic (DB inserts, bcrypt hash) lived directly in the register route handler. The domain word "Amorçage" appeared only in CONTEXT.md, not in the codebase.

2. **The `nomExpediteurEmail` gap (deferred from ADR-0008).** ADR-0008's F1 finding identified that the setup wizard stored `DomaineEmail` but not `NomExpediteurEmail` at bootstrap, even though the column existed. Candidate 3 was designated the owner of the fix. The `loadSocieteIdentity` memoized resolver (from Candidate 2) tolerated the null column via env-fallback, but the Societe would use env-var defaults until manually PATCHed.

3. **The "five count checks" re-audit.** The architecture report's Candidate 3 originally framed Amorçage as "five count checks across the codebase." The re-audit narrowed this: only two were true count gates (`/api/setup/register` and `/api/setup/status`). The other row reads — the Societe lookup in `getSocieteBranding` (login-page branding) and the identity read in `loadSocieteIdentity` — count zero Societes as a byproduct of their query shape, not as a membership gate. These are row reads belonging to Candidate 2's `lib/societe-identity` module, consolidated under ADR-0006's single-adapter-collapse mandate. They are not consolidated under this module.

## Decision

**Reify Amorçage as a lifecycle-state module.** Extract the count gate and atomic bootstrap into `lib/amorcage` — two free functions, flat module, no port/interface seam. This is a lifecycle-state module (a named state carried in code), not a DB-port re-extraction per ADR-0006.

### What this means in practice

- **`estEnAmorcage()`** — an async boolean function: "are we in the setup state?" Calls `COUNT(societes)` and returns `true` when count is zero. Not memoized — every call re-reads the row count. A cheap query and the caller already never double-checks intra-request.

- **`quitterAmorcage(input)`** — an async function that performs the atomic transition out of Amorçage: writes the Societe (including `NomExpediteurEmail`), Departements, and first Utilisateur in a single `db.transaction`, or rolls back. Key properties:
  - **Owns the transaction.** Unlike `appliquerEffets` (ADR-0007) which runs inside the caller's `db.transaction`, `quitterAmorcage` owns the tx boundary. There is no caller-side transaction to join — the route is the caller and has no transactional concerns.
  - **Re-checks the count inside the transaction.** Between the `estEnAmorcage()` check (route-level, stale) and the `db.transaction` callback, another concurrent request could have created a Societe. The re-check inside the tx closes the race: if another writer committed first, the inner check throws `AmorcageDejaConfigureError` and the tx rolls back (no inserts to clean up — the tx never committed).
  - **bcrypt hash outside the transaction.** The password hash is computed before the `db.transaction` callback. Hashing is slow and stateless — no reason to hold a transaction open for it.
  - **Writes `NomExpediteurEmail` at last.** The ADR-0008 F1 gap is closed: the Societe row now receives `nomExpediteurEmail` during the bootstrap insert.
  - **Calls `clearCache()` after commit.** `quitterAmorcage` clears the `loadSocieteIdentity` memoized cache (from Candidate 2's `lib/societe-identity`) after the tx commits, ensuring the next identity read picks up the freshly written Societe row. This is the module's coupling point with Candidate 2 — documented, not hidden.

- **`AmorcageDejaConfigureError`** in `lib/errors.ts` (status 409). Thrown by `quitterAmorcage`'s inner count check. Caught by the route and returned as `{"error": "Cette instance est déjà configurée"}`.

- **Routes thinned to HTTP translation.** `/api/setup/register` delegates to `quitterAmorcage(validated)` after schema validation; `/api/setup/status` delegates to `estEnAmorcage()`. No inline DB logic in either route.

- **Schema `.refine()` membership guard.** `setupRegisterSchema` now includes a `.refine()` that rejects payloads where `admin.departementNom` is not in `departements` — pure cross-field validation at the schema layer. The inline guard in the route was removed when the route was thinned.

### What this does NOT mean

- **This does not consolidate the Societe row reads at `/api/societe` or `getSocieteBranding`.** Those belong to Candidate 2's `lib/societe-identity` (per ADR-0006), reading existing Societe rows for UI branding and email identity. This module reads Societes only for the membership count gate — two different concerns.

- **This is not a DB-port re-extraction.** `lib/amorcage` is a lifecycle-state module, not a port/adapter seam. ADR-0006 collapses single-adapter seams at local-substitutable boundaries; this module never had ports — it extracts inline logic into a named module without adding ports. The distinction is recorded here and in ADR-0006.

- **This is not memoized.** `estEnAmorcage` re-reads the row count on every call. Memoization would be inappropriate for a state that changes once (the transition out of Amorçage) and only during the bootstrap.

- **This is not an HTTP handler.** The module operates on domain primitives — routes do HTTP translation (parse, validate, delegate, respond). Moving HTTP logic into the module would duplicate concerns across future callers (CLI setup, seeding scripts).

## Rationale

- **Atomicity.** If the bootstrap fails mid-way (network partition, unique constraint on email, server crash), the transaction rolls back. The system stays in Amorçage and the wizard re-offers the form. Without a transaction, a partial write could leave the system with an orphan Societe row but no admin Utilisateur, in a state that is neither in Amorçage nor configured.

- **The `nomExpediteurEmail` gap fix closes a real configuration bug.** ADR-0008's env-fallback tolerated the gap but every Societe that bootstrapped before this fix would send emails with the env-var sender name (or app placeholder) until an admin manually PATCHed the field. The gap existed because the bootstrap logic and the email-identity module were owned by different candidates; the fix required this module to own the write.

- **Vocabulary alignment.** The domain word "Amorçage" now appears in code as `import { estEnAmorcage, quitterAmorcage } from "@/lib/amorcage"` — the same word used in CONTEXT.md, in route documentation, and in conversation. Code and vocabulary match.

- **The race is low-probability but cheap to close.** Two concurrent bootstrap requests (window of one HTTP round-trip) is vanishingly unlikely in a single-tenant setup-wizard flow. But the fix is one extra `count()` inside the transaction — zero cost to read, permanent correctness guarantee.

## Consequences

- One module (`lib/amorcage`) replaces two inline count gates and the multi-step bootstrap logic in the register route.
- The `nomExpediteurEmail` persistence gap is permanently closed — every bootstrap from this ADR forward writes the sender name.
- `clearCache` is the coupling point with Candidate 2's `lib/societe-identity`. The coupling is one-directional: `quitterAmorcage` clears the cache; `loadSocieteIdentity` knows nothing about Amorçage. Documented in `lib/amorcage.ts:94` (inline `clearCache()` call) and referenced from this ADR.
- The Societe row-read distinction (count gate vs identity read) is recorded here and in ADR-0006. Future reviewers should not suggest consolidating `getSocieteBranding` or `loadSocieteIdentity` row reads under this module — they are different concerns.
