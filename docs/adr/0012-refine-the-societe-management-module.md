# ADR 0012: Refine the Societe management module — atomicity, schema, identity-scope split, warn-once

**Date:** 2026-07-30

**Status:** Accepted

## Context

Commit `9eaec36` reified the Societe management module — `lib/societe/index.ts` now owns `getSocieteBranding`, `loadSocieteIdentity`, `updateSociete`, and `clearSocieteCache`, with a PGLite suite (`lib/societe/index.test.ts`); the API route thinned to delegate; the legacy flat `lib/societe.ts` and `lib/societe-identity.ts` were deleted. That commit closes the patch-side deferral of ADR-0009 line 42 (the Societe row-read consolidation) and F1 of ADR-0008 (Amorçage `nomExpediteurEmail` persistence). Four residuals survived the reification:

1. **Atomicity.** `updateSociete` (`lib/societe/index.ts` L95-138) writes the row, then clears the cache, then calls `logAudit(event, dbArg)` — three separate statements, not inside `db.transaction`. A failure between the row write and the audit insert leaves a committed Societe row with no `journal_audit` row — the inverse of CONTEXT.md L96's invariant ("JournalAudit records *committed* state changes"). The same gap exists in `UtilisateurService` / `VehiculeService` (Candidate 2 of the concurrent architecture review) and now in `updateSociete`. ADR-0007 set the canonical shape for transition writers (`appliquerEffets(tx, …)` inside the caller's `db.transaction`); ADR-0009 set the canonical cache-coupling shape (clear after commit).

2. **Validation.** `updateSociete` (L105-116) hand-rolls an allow-list and an "at-least-one-key" check inline; the PATCH route (`app/api/societe/route.ts` L31-32) passes raw `req.json()` straight through. Every other mutation route uses `withValidation(schema, handler)` from `lib/api-utils.ts` with a zod schema declared in `lib/schemas.ts`.

3. **GET scope.** `GET /api/societe` is the **unauthenticated** Societe row reader — `app/(auth)/login/page.tsx:35` calls it from a client-side `useEffect` to render login-page branding. The page's TS interface (`page.tsx:16-22`) declares only `{ nom; logoUrl; faviconUrl; couleurPrimaire }`, but the endpoint returns the full shape including `nomExpediteurEmail` + `domaineEmail` (the EmailSender's identity configuration — CONTEXT.md L88-91) to unauthenticated callers. The management page (`app/(dashboard)/administration/societe/page.tsx:31`, behind the `(dashboard)` auth-redirect) needs both visual and identity fields.

   Sub-effect: `getSocieteBranding` returns `domaineEmail` as the **composed** value produced by `loadSocieteIdentity` (`noreply@<domain>`, see `lib/societe/index.ts` L73). The management-page form pre-populates with that composed value; on save it writes the composed value back as the column's `domaineEmail`, so the next `loadSocieteIdentity` produces `noreply@noreply@<domain>` — a round-trip corruption transient on any admin save.

4. **Silent failure.** `getSocieteBranding` (L23-42) still has the empty `catch { return null }` that ADR-0008 line 31 named as one of the two silences its "warn-once-and-succeed" contract would "replace." The `EmailService.send` half was closed (the warn-once pattern now lives in `loadSocieteIdentity`, L77-81); the `getSocieteBranding` half was not — commit `9eaec36` migrated the function verbatim with the silent catch intact. *(Post-adoption annotation: issue #150 is aligned with this ADR's pending residual — the generated-document surfaces (PDF + print page) consume exactly the visual fields (`nom`, `couleurPrimaire`) this ADR proposes narrowing `getSocieteBranding` to, and leave the `catch → null` residual untouched.)*

## Decision

Refine the just-reified `lib/societe` module to close the four residuals above.

### What this means in practice

- **Atomicity.** `updateSociete(changes, actorId, dbArg = db)` becomes `db.transaction(async (tx) => { await tx.update(societes).set(...).where(...); await logAudit(event, tx); })`; only after the awaited tx commits, `clearSocieteCache()` runs. Mirrors ADR-0007's `appliquerEffets(tx, …)` shape and ADR-0009's `quitterAmorcage` cache-after-commit pattern. The module **owns** its transaction boundary — the route is the caller and has no surrounding tx to join.

- **Validation.** Add `societeUpdateSchema = z.object({ nom: z.string().min(1, "Nom requis").optional(), logoUrl: z.string().nullable().optional(), faviconUrl: z.string().nullable().optional(), couleurPrimaire: z.string().nullable().optional(), nomExpediteurEmail: z.string().min(1, "Nom d'expéditeur requis").optional(), domaineEmail: z.string().min(1, "Domaine email requis").optional() }).strict().refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée à mettre à jour" })` to `lib/schemas.ts`. Export `SocieteUpdate = z.infer<typeof societeUpdateSchema>`. The PATCH route becomes `export const PATCH = withValidation(societeUpdateSchema, async (_req, auth, data) => { const result = await updateSociete(data, auth.user.id); return NextResponse.json(result) })`. Delete the in-module allow-list and the empty-check from `updateSociete`; its `changes` parameter narrows to `SocieteUpdate`. Mirrors `utilisateurs` / `vehicules` / `demandes` exactly — the service trusts the validated shape.

- **GET scope.**
  - `GET /api/societe` (public, no `requireAuth`) returns only visual identity: `{ id, nom, logoUrl, faviconUrl, couleurPrimaire } | null`. Matches the login page's TS interface verbatim; the login page is unchanged.
  - New `GET /api/societe/identity` (with `requireAuth`) returns the EmailSender identity fields for the management page: `{ id, nom, logoUrl, faviconUrl, couleurPrimaire, nomExpediteurEmail, domaineEmail }`, where `nomExpediteurEmail` and `domaineEmail` are the **raw** column values (NOT the composed `noreply@<domain>` from `loadSocieteIdentity`). Closes the round-trip-corruption transient above: the form pre-populates with raw values; save writes raw values back.
  - `getSocieteBranding` (`lib/societe/index.ts`) narrows its return shape to visual identity only. The internal `loadSocieteIdentity()` call inside `getSocieteBranding` is removed — public reads no longer traverse the cached identity seam.
  - The new authenticated route reads the raw Societe row through a lib helper (e.g. `getSocieteRow(dbArg?)`) returning the raw row, added to the existing module alongside the existing exports.

- **Silent failure.** `getSocieteBranding`'s empty `catch { return null }` becomes `catch { if (!warnedBrandingOnce) { console.warn("[SocieteBranding] Database unreachable — returning null"); warnedBrandingOnce = true; } return null }`, mirroring `loadSocieteIdentity`'s existing `console.warn("[SocieteIdentity] Database unreachable — using SMTP env fallback")` pattern in the same file. Caller behavior unchanged (null → "Application" branding); the silence becomes observable. Closes ADR-0008 line 31's deferred half.

### What this does NOT mean

- **This does not re-open ADR-0006's restriction on re-extracting DB ports.** `lib/societe` stays free functions over PGLite-testable Drizzle, no reified `SocieteManagement` interface. The decision is a refinement; the module shape landed by commit `9eaec36` is preserved.

- **This does not change `loadSocieteIdentity`'s memoized identity contract.** `clearSocieteCache` remains the single invalidation seam, now called by `quitterAmorcage` (per ADR-0009) and by `updateSociete` (per this ADR). The composed `noreply@<domain>` form continues to be produced by `loadSocieteIdentity` for the EmailSender; it is no longer exposed through `getSocieteBranding`.

- **This does NOT split `lib/societe` into multiple directories.** The visual reader, the cached identity reader, the writer, the warn-once hook, and the raw-row helper all stay in `lib/societe/index.ts`. The GET-scope split is a **route-layer** split (`/api/societe` vs `/api/societe/identity`), not a lib split.

- **This does NOT extend atomicity to the Utilisateur/Vehicule modules.** ADR-0007 + ADR-0011 + this ADR establish the *principle* (mutation + audit inside one `db.transaction`); applying it to those services is Candidate 2 of the concurrent architecture review and is tracked separately. Don't assume this ADR's precedent is auto-applied there.

- **This does not invalidate the existing `lib/societe/index.test.ts` suite.** All five `updateSociete` tests continue to assert — the tx wrapping changes no assertion (PGLite exercises the same shape). The `getSocieteBranding` tests narrow their expected shape to visual-only; the identity-field expectations move to a new identity-route test. The warn-once addition is observable via a `console.warn` spy assertion.

## Rationale

- **Atomicity closes the inversion of CONTEXT.md's JournalAudit invariant.** A missing audit for a committed change is ghost-provenance — future readers of `journal_audit` can't reconstruct *what* changed if the audit row failed to insert. The pattern is proven in `lib/demande/effets-transition.ts` and `lib/amorcage.ts`; this ADR extends it to one non-transition writer, opening a precedent Candidate 2 can cite.

- **Validation mirrors the rest of the codebase.** The right home for "what fields a Societe PATCH may carry" is a zod schema in `lib/schemas.ts`, not an inline list — consistent with `setupRegisterSchema` (which demonstrates cross-field `.refine`). The schema's `.strict()` makes unknown keys a 400 rather than a silent drop.

- **GET scope closes an unintended unauthenticated leak of EmailSender identity configuration** and a latent round-trip corruption of the `domaineEmail` column. Restricting public GET to visual identity aligns the route's response shape to the login page's existing client interface verbatim, and restricting the composed `noreply@...` form to `loadSocieteIdentity`'s EmailSender seam establishes a clean boundary between **stored configuration** and **derived sender email**.

- **Warn-once closes ADR-0008 line 31's deferred promise** for `getSocieteBranding` and matches the `loadSocieteIdentity` pattern already in the same file. Future ops can tell `Societe unreachable` from `Societe not yet configured`.

## Consequences

- `updateSociete` becomes one `db.transaction` boundary; `app/api/societe/route.ts` PATCH's export signature changes from `export async function PATCH` to `export const PATCH = withValidation(societeUpdateSchema, ...)`.
- `getSocieteBranding`'s return type narrows from `SocieteBranding` (7 fields) to `SocietePublicBranding` (5 visual fields + `id`). Callers (`app/(dashboard)/layout.tsx`, the public GET route, and the lib's own internal consumer) compile against the narrowed shape. The `SocieteBranding` interface is renamed `SocietePublicBranding` for accuracy.
- New route file `app/api/societe/identity/route.ts` exports `GET` with `requireAuth`. The management-page client `useEffect` splits one fetch into two parallel fetches (visual + identity); both endpoints sit behind the `(dashboard)` redirect.
- `lib/schemas.ts` gains `societeUpdateSchema` + `SocieteUpdate`.
- ADR-0008 line 31's open promise closes. ADR-0009 line 42's "row-reads at `/api/societe` belong to Candidate 2's consolidation" is now actually consolidated. ADR-0007 + ADR-0011's atomicity invariant extends to one non-transition writer, opening the precedent for Candidate 2.
- Future architecture reviews should not re-suggest: (i) wrapping `updateSociete` in `db.transaction`; (ii) adding a `societeUpdateSchema` + `withValidation`; (iii) splitting GET scope; (iv) refactoring `getSocieteBranding`'s empty `catch`.

## Tickets

Tracer-bullet tickets are filed alongside this ADR via the `/to-tickets` skill. Each ticket declares its blocking edges. The schema-validation ticket (T1) **blocks** the atomicity ticket (T2) — once `updateSociete`'s `changes` parameter narrows to `SocieteUpdate` and the allow-list is deleted, the atomicity ticket's `db.transaction` wrap of the now-clean body is mechanically smaller (no allow-list code inside the new tx). The GET-scope-split ticket (T3) and the warn-once ticket (T4) are **independent** of T1+T2 and may land in parallel.