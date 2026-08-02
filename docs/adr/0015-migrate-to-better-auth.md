# ADR 0015: Migrate authentication from next-auth@5 (beta) to Better Auth

**Date:** 2026-08-02

**Status:** Accepted

## Context

Authentication currently runs on **next-auth@5.0.0-beta.32** (npm `beta` dist-tag — v5 never left beta). The Better Auth team took over maintenance of Auth.js in September 2025; Auth.js is now in maintenance mode (security + urgent issues only) and next-auth@5 remains unpublished as stable. An official, maintained migration guide exists on both better-auth.com and authjs.dev. Full primary-source research in `docs/research/better-auth.md`.

The current auth surface is already a deep module at `lib/auth/server.ts`: `AuthUser` + `requireAuth` / `requireRole` / `requireAnyRole` / `getAuthUser` / `hasAnyRole`, crossed by ~20 API route handlers, 7 server pages, and 12 test files that all mock `@/lib/auth/server`. NextAuth leaks through the seam in four places:

- `auth()`, `handlers`, `signIn`, `signOut`, `GET`/`POST`, `authConfig` re-exported from the barrel — 7 pages call raw `auth()` and depend on the next-auth session shape;
- `proxy.ts` imports `NextAuth` and `authConfig` directly;
- client components import `useSession` / `signIn` / `signOut` from `next-auth/react` in 8 files, plus `<SessionProvider>` in the root layout;
- `types/next-auth.d.ts` augments the next-auth module.

Auth flows in play: email/password credentials (bcryptjs against `utilisateurs.motDePasse`, JWT session strategy, 7-day maxAge), Google OAuth gated on `utilisateurs.googleAuthEnabled` + `actif`, and an initial setup wizard that signs in after provisioning the first admin.

## Decision

**Migrate to Better Auth (npm `better-auth`, MIT), keeping the `@/lib/auth/server` seam and its interface byte-identical.**

### What stays

- `AuthUser`, `requireAuth()`, `getAuthUser()`, `requireRole()`, `requireAnyRole()`, `hasAnyRole()` — same signatures, same semantics, same `{ok:false, response}` result pattern (401/403 `NextResponse` JSON). All 12 mocking test files keep working untouched.
- The domain role model stays a single-string role on the user row; authorization continues through the existing `require*` helpers.

### What swaps behind the seam

- **Adapter**: `lib/auth/better.ts` — `betterAuth({ database: drizzleAdapter(db, { provider: "pg" }), emailAndPassword, socialProviders: { google }, plugins: [nextCookies()] })`. `nextCookies` must be the last plugin (Server Actions set cookies).
- **Users table: map onto the existing `utilisateurs` table** (Fork A), via `user.modelName`/`fields` mapping and `additionalFields` for `role`, `departementId`, `poste`, `actif`, `googleAuthEnabled`, `avatarUrl` — server-owned (`input: false`). No new `user` table; every existing `utilisateurs` join and query stays valid. One user concept, one table.
- **Passwords**: Better Auth stores credentials in the `account` table with `providerId: "credential"` (documented requirement — without this row, password sign-in fails). One-time data migration copies `utilisateurs.motDePasse` (bcrypt hashes) into `account` rows; `password.hash` / `password.verify` are configured as bcryptjs wrappers so existing hashes keep verifying — no forced password reset.
- **Session strategy**: JWT → database-backed sessions (7-day expiry, 1-day sliding renewal — equivalent to today's `maxAge`). Cookie prefix changes to `better-auth.*`; existing sessions invalidated once at cutover (acceptable).
- **Google**: `socialProviders.google`; the `googleAuthEnabled` + `actif` gating must be re-implemented with Better Auth's sign-in hooks — exact mechanism (per-provider `disableSignUp` vs. a before/after hook) to be verified against the docs at implementation time, behavior parity with today's veto is required.

### What is NOT adopted

- **No admin plugin.** `requireRole` / `requireAnyRole` already encode authorization with 20+ callers and a full test suite; the admin plugin would introduce a parallel permission system (two ways to do the same thing). Roles stay server-owned `additionalFields`. Revisit only if user-management CRUD (currently in `app/api/utilisateurs/*`) ever wants plugin-provided endpoints.
- **No organization/2FA plugins** — not needed for the current single-tenant, single-role-per-user model.

### Touchpoints

| File | Change |
|---|---|
| `lib/auth/better.ts` | new — the Better Auth adapter |
| `lib/auth/session.ts` | keep `getSessionUser` mapping + helpers; source them from `auth.api.getSession`; drop NextAuth |
| `lib/auth/server.ts` | barrel unchanged except exports that die (`handlers`, `GET`/`POST`, `signIn`, `signOut`, `authConfig`); `auth` becomes the `betterAuth` instance |
| `lib/auth/config.ts` | deleted (`jwt`/`session`/`authorized` callbacks → `additionalFields` + explicit proxy check) |
| `app/api/auth/[...nextauth]/route.ts` | renamed to `[...all]/` with `toNextJsHandler(auth)` |
| `proxy.ts` | `auth.api.getSession({ headers })` + redirect to `/login`; same matcher |
| 7 pages using raw `auth()` | switch to `getAuthUser()` — removes the last next-auth shape leakage from the seam |
| `lib/auth/client.ts` | new — `useAuthUser` / `signInWithCredentials` / `signInWithGoogle` / `signOut` over `createAuthClient()`, mapped to the same `AuthUser` shape |
| 8 client files + root layout | import from `@/lib/auth/client`; drop `<SessionProvider>` (Better Auth needs none) |
| `db/schema/` | new `session` / `account` / `verification` tables via `npx auth@latest generate` + `drizzle-kit`; `utilisateurs` gains `emailVerified` (bool) + `updatedAt` as required |
| `scripts/` | data migration: `account` rows seeded from `motDePasse` |
| `.env.example` | `NEXTAUTH_SECRET` → `BETTER_AUTH_SECRET` (≥32 chars); `AUTH_GOOGLE_ID/SECRET` carry over |
| `types/next-auth.d.ts`, `lib/auth/session.test.ts` | deleted / rewritten (it mocks next-auth directly) |
| `package.json` | remove `next-auth`; add `better-auth`, `@better-auth/drizzle-adapter` |

### Call-site cleanup (in passing)

`app/api/utilisateurs/route.ts:27,49` pass the whole `AuthResult` to `requireAnyRole(auth, …)` instead of `auth.user` — a latent misuse of the interface; fixed while touching the file.

## Rationale

- **The seam is proven real, so the swap is cheap.** One adapter (NextAuth) exists behind `@/lib/auth/server` today; the migration adds a second (Better Auth). "Two adapters means a real seam" — the interface has earned its keep, and the deletion test passes: 20+ callers each re-implementing session + role checks would recreate all the complexity the module hides.
- **Fork A over Fork B.** Adopting the CLI-generated `user`/`account`/`session` tables would split the domain's single user concept across two tables and ripple through every `utilisateurId` reference (`demandes`, `journal-audit`, …). Mapping Better Auth onto `utilisateurs` hides that complexity inside the adapter instead of exporting it to callers — depth.
- **next-auth@5 is beta and unmaintained.** Security fixes only, from a team that now recommends Better Auth for new work. The maintenance-mode status removes the cost/benefit case for staying.
- **Official migration guidance exists** and is primary-source verified (see `docs/research/better-auth.md` §8); the schema delta is a known, documented restructure, and bcrypt-compatible hash/verify options avoid a reset storm.
- **JWT → DB sessions is a strict improvement** for a multi-role approval pipeline: role changes, `actif` deactivation, and session revocation take effect without waiting for token expiry.

## Consequences

- One-time user-facing cutover: everyone is signed out (new cookie name).
- `account` rows are the new password home; `motDePasse` column dropped after the data migration is verified.
- Session data (role, departement) now comes from the DB per request instead of the JWT — an extra query per authenticated request unless Better Auth's `session.cookieCache` is enabled (evaluate at implementation).
- Google gating re-verification is the main behavioral risk; parity tests should cover: disabled user, non-Google-enabled user, Google-enabled user.
- The plan below is executed in sequence; each step keeps the app building and tests green.

## Plan (execution order)

1. **Dependencies + env**: install `better-auth`, `@better-auth/drizzle-adapter`; add `BETTER_AUTH_SECRET` (≥32 chars) to env + `.env.example`.
2. **Schema**: create a minimal `auth.ts` config and run `npx auth@latest generate` to emit the `session`/`account`/`verification` tables (+ `relations`); `npx drizzle-kit generate` + `migrate`.
3. **Adapter**: write `lib/auth/better.ts` — drizzle adapter on `db`, `user.modelName`/`fields` mapping to `utilisateurs`, `additionalFields` for domain fields, bcryptjs `password.hash`/`verify`, `emailAndPassword`, Google provider, `nextCookies()` last.
4. **Seam internals**: rewrite `lib/auth/session.ts` so `getAuthUser`/`requireAuth` read from `auth.api.getSession`; keep all signatures; export `auth` as the Better Auth instance.
5. **Route handler**: rename `app/api/auth/[...nextauth]` → `[...all]`, export `toNextJsHandler(auth)`.
6. **Proxy**: replace NextAuth `.auth` with `auth.api.getSession({ headers })` + redirect to `/login`; keep matcher.
7. **Client**: `lib/auth/client.ts` (`useAuthUser`, `signInWithCredentials`, `signInWithGoogle`, `signOut`); update the 8 client files; remove `<SessionProvider>` from root layout.
8. **Pages**: convert the 7 `auth()`-calling pages to `getAuthUser()`.
9. **Data migration**: scripts/ one-off seeding `account` rows (`providerId: "credential"`, password = `motDePasse`) per utilisateur with a password; verify a sample of logins before dropping `motDePasse`.
10. **Removal**: delete next-auth from `package.json`, `types/next-auth.d.ts`, `lib/auth/config.ts`; rewrite `lib/auth/session.test.ts`; fix the `requireAnyRole(auth, …)` call sites.
11. **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`; manual pass of login (valid/invalid/disabled), Google (enabled/disabled user), setup wizard, and one role-gated flow per role.
