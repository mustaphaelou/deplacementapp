# ADR 0018: One module decides whether a Utilisateur is signable; `proxy.ts` stays an optimistic cookie check

**Date:** 2026-10-08

**Status:** Accepted

## Context

ADR-0016 established `@/lib/auth/server` as the auth seam and ADR-0017 rebuilt the Google gate on `user.validateUserInfo`. Both were correct, and both left the same question answered in more than one place.

What makes a sign-in valid — *does this Utilisateur exist, are they active, and (for ConnexionGoogle) is Google enabled for them* — is asserted three times, with three different shapes:

| Site | Reads | Projection | Answer when the row is missing |
|---|---|---|---|
| `lib/auth/session.ts:29` (`isActif`) | `eq(id, userId)` | `{ actif }` only | indistinguishable from deactivation (`row?.actif ?? false`) — answers 401 |
| `lib/auth/google-guard.ts:47` | `lower(email) = lower(?)` | `select()` — every column | distinct: refuses `utilisateur_introuvable` |
| `proxy.ts:5` (`getSessionCookie`) | cookie presence | none | redirect to `/login` |

A fourth, weaker definition lives outside `lib/auth` entirely: `proxy.ts` imports `better-auth/cookies` directly — the only `better-auth` import in the repo outside the module — and asserts "signed in" from the *presence* of an unverified `better-auth.session_token` value. It agrees with neither of the other two on any fact.

Three consequences followed:

- **No locality for the rule.** Each site would have to be edited independently, and nothing asserted they agreed. The gate's own projection pulls `avatarUrl`, `telephone`, `dateEmbauche`, `societeId` and `departementId` into memory to read two booleans, while the session read selects one column for the same fact.
- **A forbidden test pattern.** `lib/auth/session.test.ts:17-30` mocks `../../db` and hand-rolls a Drizzle query-builder chain — the only such mock in the repository, and directly contrary to ADR-0006 ("no mocks of query-builder chains, no adapter test doubles"). The module under test has 64 lines of implementation whose only branch is `if (!user) return null`; 329 lines of test stub every collaborator to reach it. PGLite is already the accepted Postgres stand-in and is used by `lib/amorcage.test.ts`, `lib/auth/better-auth.test.ts` and `lib/auth/google-callback.test.ts`.
- **An untested seam.** `proxy.ts` has no test and no name for what it does, so it reads as an oversight rather than a decision. Anyone auditing the auth path reasonably concludes it is a bug and "fixes" it into a per-request database check.

## Decision

**One module owns the rule. `proxy.ts` does not.**

1. **Reify the rule as a module** — `lib/auth/identity.ts`, sitting behind the ADR-0016 seam, with two named predicates and no criterion unions, overloads, or factories:
   - `estUtilisateurSignable(id)` — existence + `actif`. Asked by the session path, which holds an id.
   - `estUtilisateurGoogleSignable(email)` — existence + `actif` + `googleAuthEnabled`, with the case-insensitive match ADR-0017 §2 specifies. Asked by the Google gate, which holds an e-mail.

   Two names because there are two facts; a criterion union would make every caller construct a discriminant to read one field, and overloads would make the return type ambiguous.

2. **The verdict carries a reason, not a boolean.** Absence and deactivation are distinct outcomes, and the caller may need to say which. One reason vocabulary for both predicates:

   ```ts
   type RaisonRefus = "introuvable" | "desactive" | "google_non_active"
   ```

   `RaisonRefus` is the domain vocabulary; `GOOGLE_REFUSAL_CODES` (`utilisateur_introuvable`, …) is the wire/presentation vocabulary and is **derived** from the reasons rather than restated alongside them, so the two cannot drift. This retires the `?? false` trick at `session.ts:35` that made a nonexistent Utilisateur indistinguishable from a deactivated one.

3. **A found Utilisateur returns its fields, not just a verdict.** The predicate's query already selects the row; discarding it and re-reading is the shallow pattern this change exists to remove. A found Utilisateur yields the `AuthUser` projection, so the session path stops doing its own mapping and `AuthUser.departement` — currently hardcoded `""` at `lib/auth/user-mapper.ts:38` and pinned as `""` by `user-mapper.test.ts:26,63` — gets a real source.

4. **`proxy.ts` stays an optimistic cookie-presence check**, and says so. Next 16 runs proxy on the Node.js runtime by default and cannot be configured otherwise (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:221`), so a database check is *possible* there — but this deployment's session strategy is database-backed (`lib/auth/better-auth.ts:32` sets `drizzleAdapter` with no `session` option, so no cookie cache), making `auth.api.getSession` 1–2 SQL queries per matched request. Next's own guidance is to "only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues" (`docs/01-app/03-api-reference/03-file-conventions/data-security.md:1031`). Proxy is a first gate whose answer is provisional; the real answer is the session seam. It gains a comment and a test, not a database call.

5. **E-mail case-folding stays a matching concern.** The module owns the *match* (case-insensitive, per ADR-0017 §2), not the *storage*. ADR-0017's recorded limitation — the engine's own user-by-e-mail lookup is case-sensitive, so a first-time link for a stored mixed-case address fails closed — remains open, and `utilisateurs`' `uniqueIndex` on `email` is case-sensitive under Postgres, so two casings of one address can both exist today. Normalising on write plus a migration, and a case-insensitive unique index, are separate follow-ups; the index is a schema decision that deserves its own ticket.

6. **`AuthUser.role` becomes `Role`** — but in a **separate change**. The `role: string` widening at `lib/auth/user-mapper.ts:36` is the sole cause of 14 `as Role` casts across 11 files and of the unguarded `PIPELINE_VIEWS[role]` lookup at `lib/workflow.ts:149`. It is mechanically trivial and review-heavy, and it lands better once this module exists to hang it on.

## Rationale

- **Locality for a three-fact rule.** Existence, activity and Google enablement get one home; the two call sites stop restating them, and the projections stop disagreeing.
- **The interface is the test surface.** Once the read sits behind two named predicates, `session.test.ts` no longer needs to mock `../../db` or `drizzle-orm` — the module's own suite exercises real SQL through PGLite, which is what ADR-0006 asked for and the only forbidden test pattern in the repo deleted as a side effect.
- **A reason, not a boolean.** The gate must explain a refusal in French per code; making the reason a value the module produces, rather than a fact each call site re-derives, is what keeps the wire codes and the domain reasons from drifting.
- **A read is not worth discarding.** Returning the row collapses the session path's mapping and gives `departement` a source, at no extra query cost.
- **Proxy is a different question, deliberately.** "Is there a cookie?" and "may this Utilisateur hold a session?" are different facts with different costs. Collapsing them buys nothing — every protected page already calls `getAuthUser()` — and costs a database round-trip per navigation.

## Consequences

- `lib/auth/session.ts` and `lib/auth/google-guard.ts` both call `lib/auth/identity.ts`; neither owns a Utilisateur read.
- `lib/auth/session.test.ts` shrinks from 329 mocked lines to a small wiring test: the engine's `getSession` stays mocked (it is the library seam), the Utilisateur read does not.
- The refusal-code assertions in `lib/auth/better-auth.test.ts` migrate to the identity module's suite, **keeping a thin gate-level test** — the callback suite proves the wiring end to end; the small gate test proves which wire code each reason maps to, which the callback suite only observes indirectly through a redirect URL.
- `lib/auth/google-callback.test.ts` is unchanged: it already crosses the real interface against PGLite.
- `proxy.ts` gains a comment naming it the optimistic check and a test pinning that behaviour, so the next reader does not mistake it for a missing check.
- ADR-0006's "no mocks of query-builder chains" is now true of the whole repository.
- `lib/auth/user-mapper.ts` remains for the client seam (`lib/auth/client.ts:24`) with its hand-written `BetterAuthSessionUser`; deriving that type from `auth.$Infer.Session.user` is a follow-up that changes the client seam's shape.
- Open follow-ups, deliberately not settled here: stored-e-mail normalisation (decision 5), `AuthUser.role: Role` (decision 6), and deriving the session-user type.

## Verification

- `lib/auth/identity.test.ts` — PGLite, real SQL: each reason for each predicate; absence distinguished from deactivation; the case-insensitive e-mail match; a found Utilisateur's projection including `departement`.
- `lib/auth/session.test.ts` — engine `getSession` mocked, identity module exercised against PGLite; asserts that a deactivated Utilisateur yields 401 and that the session path no longer casts.
- `lib/auth/google-callback.test.ts` — unchanged, still drives the whole Google dance over PGLite.
- `proxy.ts` — new test pinning the optimistic redirect on cookie absence.
