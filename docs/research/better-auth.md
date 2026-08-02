# Better Auth (vs next-auth v5) — Primary-Source Research

> Compiled from official Better Auth docs, the better-auth GitHub repo, npm registry, and official Auth.js docs. Last updated: 2026-08-02.

> **Purpose:** Inform the deplacementapp team's decision on whether/how to move from next-auth@5 (beta) to Better Auth, in a Next.js 16 App Router + Drizzle ORM + Postgres app with EMPLOYEE/MANAGER/FINANCE_ADMIN/GENERAL_DIRECTION roles.

---

## 1. What Better Auth Is & Architecture

Better Auth is a **framework-agnostic, universal authentication and authorization framework for TypeScript**, self-described as "the most comprehensive auth library":

> "Better Auth is a framework-agnostic, universal authentication and authorization framework for TypeScript. It provides a comprehensive set of features out of the box and includes a plugin ecosystem that simplifies adding advanced functionalities. Whether you need 2FA, passkey, multi-tenancy, multi-session support, or even enterprise features like SSO, creating your own IDP…"

[Source](https://better-auth.com/docs/introduction)

Key architecture points:

- **Server-side library, runs in your app.** It is mounted as a catch-all route handler (`/api/auth/*` by default) on "any backend framework with standard Request and Response objects" — Next.js App Router, Pages Router, Nuxt, SvelteKit, Express, Hono, Astro, TanStack Start, Expo, and more. [Source](https://better-auth.com/docs/installation), [Source](https://better-auth.com/docs/integrations/next)
- **Database-backed** (user/session/account/verification tables) or **stateless** (signed/encrypted cookie, no DB). Most plugins require a database. [Source](https://better-auth.com/docs/installation), [Source](https://better-auth.com/docs/concepts/database), [Source](https://better-auth.com/docs/concepts/session-management)
- **Plugin ecosystem**: everything beyond core email/password + social login is a plugin (2FA, organization, admin/roles, passkey, username, magic link, SSO, billing…). Plugins add their own endpoints, schema tables, and client-side methods. [Source](https://better-auth.com/docs/introduction), [Source](https://better-auth.com/docs/plugins/organization)
- **Client library** (`better-auth/react` for React): `createAuthClient()` with typed, reactive methods/hooks that call the server API. [Source](https://better-auth.com/docs/installation)
- Framework support statement: "Support for most popular frameworks" (feature list). [Source](https://better-auth.com/docs/introduction)

**Positioning vs alternatives** (official comparison page): framework agnostic, advanced features built in (2FA, multi-tenancy, rate limiting), plugin system, full control of flows, and "flexible deployment — run alongside your app or as a standalone self-hosted auth server." [Source](https://better-auth.com/docs/comparison)

---

## 2. Version, License, Release Cadence

| Metric | Value |
|---|---|
| **Latest stable (npm)** | `better-auth@1.6.23` (published 2026-07-22) |
| **Prerelease** | `v1.7.0-rc.1` (2026-07-02, GitHub "latest release", prerelease tag) |
| **License** | MIT |
| **GitHub** | 29,213 stars, 480 contributors, 946 releases since repo creation 2024-05-19 |
| **First release** | May 2024 |

[Source](https://www.npmjs.com/package/better-auth), [Source](https://github.com/better-auth/better-auth)

- License: "Better Auth is a free and open source project licensed under the MIT License." [Source](https://github.com/better-auth/better-auth)
- Repo metadata: TypeScript (100%), MIT, 946 releases, latest release v1.7.0-rc.1 (prerelease). [Source](https://github.com/better-auth/better-auth)
- npm: "1.6.23 • Public • Published 11 days ago". [Source](https://www.npmjs.com/package/better-auth)
- There is an official **1.6 → 1.7 upgrade guide** (OAuth/OIDC/MCP/SAML/SCIM/proxy/custom-adapter changes), so 1.7 is on the horizon. [Source](https://better-auth.com/docs/guides/1-7-upgrade-guide) (listed in [docs index](https://better-auth.com/llms.txt))

---

## 3. Next.js / App Router Integration

### 3.1 Route handler (mount point)

Create `app/api/auth/[...all]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

"You can change the path on your better-auth configuration but it's recommended to keep it as `/api/auth/[...all]`." (Pages Router uses `toNodeHandler` from `better-auth/node` with `bodyParser: false`.) [Source](https://better-auth.com/docs/integrations/next)

### 3.2 Client

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react" // make sure to import from better-auth/react

export const authClient = createAuthClient({
  //you can pass client configuration here
})
```

The client uses nano-store for reactive state and better-fetch for requests. [Source](https://better-auth.com/docs/integrations/next)

### 3.3 RSC and Server Actions

Every server endpoint is invocable as a function on `auth.api`. Sessions in RSCs/Server Actions:

```ts
"use server";
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const someAuthenticatedAction = async () => {
  const session = await auth.api.getSession({ headers: await headers() })
};
```

"As RSCs cannot set cookies, the cookie cache will not be refreshed until the server is interacted with from the client via Server Actions or Route Handlers." [Source](https://better-auth.com/docs/integrations/next)

**Server Action cookie caveat**: calling `auth.api.signInEmail` / `signUpEmail` inside a Server Action won't set cookies by itself — add the `nextCookies` plugin (from `better-auth/next-js`), "make sure this is the last plugin in the array", and `Set-Cookie` headers are applied automatically:

```ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  plugins: [nextCookies()] // make sure this is the last plugin in the array
})
```

[Source](https://better-auth.com/docs/integrations/next)

### 3.4 Route protection (middleware → proxy)

- **Next.js 16+**: middleware is renamed "proxy". Docs state: "Better Auth is fully compatible with Next.js 16. The main change is that 'middleware' is now called 'proxy'." Migration: rename `middleware.ts` → `proxy.ts`, function `middleware` → `proxy` (codemod: `npx @next/codemod@canary middleware-to-proxy .`). All Better Auth methods work identically. [Source](https://better-auth.com/docs/integrations/next)
- **Full validation in proxy** (Node.js runtime — Next.js 16+ supports it; experimental before 16):

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if(!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard"] };
```

- **Cookie-only optimistic checks** (docs warn: "THIS IS NOT SECURE! … We recommend handling auth checks in each page/route") via `getSessionCookie` from `better-auth/cookies`. [Source](https://better-auth.com/docs/integrations/next)
- Recommended pattern overall: **validate sessions on each page/route** (server component + `redirect`) rather than in middleware/proxy — the migration guide quotes Next.js docs: "Proxy(Middleware) is not intended for slow data fetching… it should not be used as a full session management or authorization solution." [Source](https://better-auth.com/docs/guides/next-auth-migration-guide)

---

## 4. Drizzle ORM + Postgres Adapter

> **Note on URLs:** `https://better-auth.com/docs/database/drizzle` **404s** (both with and without `www.`). The page lives at **https://better-auth.com/docs/adapters/drizzle** (confirmed via the official docs index at https://better-auth.com/llms.txt).

### 4.1 Wiring

Install the dedicated package (note: the Installation page shows an older inline import `better-auth/adapters/drizzle`; the current adapter page says to install the separate package):

```
npm install @better-auth/drizzle-adapter
```

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./database.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "sqlite" or "mysql"
  }),
  //... the rest of your config
});
```

[Source](https://better-auth.com/docs/adapters/drizzle)

### 4.2 Schema generation & migration story

1. `npx auth@latest generate` — the Better Auth CLI reads your `auth.ts` (including enabled plugins) and **writes/updates your Drizzle `schema.ts`** (also generates `relations`; per docs "run our latest CLI version `npx auth@latest generate` to generate a new Drizzle schema with the relations").
2. `npx drizzle-kit generate` — create the SQL migration from your schema.
3. `npx drizzle-kit migrate` — apply it.

The CLI searches for your config "in `./`, `./utils`, `./lib`, or any of these directories under the `src` directory." `npx auth@latest migrate` (direct DB apply) is **only** for the built-in Kysely adapter — with Drizzle you go through drizzle-kit. [Source](https://better-auth.com/docs/adapters/drizzle), [Source](https://better-auth.com/docs/concepts/cli), [Source](https://better-auth.com/docs/concepts/database)

### 4.3 Core schema (generated for `provider: "pg"`)

The docs define the four core tables — `user`, `session`, `account`, `verification` — with the following fields (types as documented; PK/FK/unique noted): [Source](https://better-auth.com/docs/concepts/database)

- **user**: `id` (PK), `name`, `email`, `emailVerified` (boolean), `image?`, `createdAt`, `updatedAt`
- **session**: `id` (PK), `userId` (FK), `token`, `expiresAt`, `ipAddress?`, `userAgent?`, `createdAt`, `updatedAt`
- **account**: `id` (PK), `userId` (FK), `accountId`, `providerId`, `accessToken?`, `refreshToken?`, `accessTokenExpiresAt?`, `refreshTokenExpiresAt?`, `scope?`, `idToken?`, `password?`, `createdAt`, `updatedAt`
- **verification**: `id` (PK), `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`

Exact CLI output (verified by running `npx auth@latest generate` against **better-auth@1.6.23** with `provider: "pg"` in a scratch project — this is what the official tool produces for the core schema):

```ts
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_userId_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
}, (table) => [index("account_userId_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);
```

*(Generated by the official CLI, `npx auth@latest generate`, better-auth@1.6.23 — the same output the docs' "Drizzle" tab displays. CLI documented at [Source](https://better-auth.com/docs/concepts/cli); schema fields at [Source](https://better-auth.com/docs/concepts/database).)*

Plugins add tables: e.g. `organization()` adds `organization`, `member`, `invitation` (verified with the same CLI run; documented at [Source](https://better-auth.com/docs/plugins/organization)).

### 4.4 Table/field naming

- Plural table names: pass `usePlural: true`, or map manually via the adapter's `schema` option or `user.modelName` in config.
- Column renaming: change the Drizzle column name (e.g. `email: varchar("email_address", …)`) or set `fields` in config. Type inference keeps using original names. [Source](https://better-auth.com/docs/adapters/drizzle)
- **Experimental joins** (`experimental: { joins: true }`): 2x–3x faster `/get-session`, `/get-full-organization` etc.; requires relations defined in your Drizzle schema. [Source](https://better-auth.com/docs/adapters/drizzle)

---

## 5. Email & Password Authentication

Enabled with one flag; the docs' core-options table: `enabled`, `disableSignUp`, `minPasswordLength` (8 default) / `maxPasswordLength` (128), `sendResetPassword`, `onPasswordReset`, `onExistingUserSignUp`, `autoSignIn`, `requireEmailVerification`, `revokeSessionsOnPasswordReset`, `resetPasswordTokenExpiresIn`, custom `password.hash`/`password.verify`. [Source](https://better-auth.com/docs/authentication/email-password)

```ts
export const auth = betterAuth({
  emailAndPassword: { enabled: true },
});
```

**Password hashing**: "Better Auth uses `scrypt` to hash passwords… natively supported by Node.js" (custom Argon2 via `@node-rs/argon2` example provided). **Passwords are stored in the `account` table** with `providerId: "credential"`, not on the user row. [Source](https://better-auth.com/docs/authentication/email-password)

### 5.1 Sign-up / sign-in / sign-out

```ts
// client
await authClient.signUp.email({ name: "John Doe", email: "john@example.com", password: "password1234", callbackURL: "…" })
await authClient.signIn.email({ email: "…", password: "…", rememberMe: true, callbackURL: "…" })
await authClient.signOut()

// server (invocable function, no HTTP round-trip)
await auth.api.signUpEmail({ body: { … } })
await auth.api.signInEmail({ body: { … }, headers: await headers() })
await auth.api.signOut({ headers: await headers() })
```

`rememberMe: false` → user signed out when browser closes. [Source](https://better-auth.com/docs/authentication/email-password)

### 5.2 Email verification

Provide `emailVerification.sendVerificationEmail({ user, url, token }, request)`; options `sendOnSignUp`, `sendOnSignIn`, `autoSignInAfterVerification`, callbacks `beforeEmailVerification` / `afterEmailVerification`. `emailAndPassword.requireEmailVerification: true` blocks sign-in until verified and triggers anti-enumeration behavior (sign-up returns a synthetic 200 for existing emails — "follows OWASP authentication best practices"). [Source](https://better-auth.com/docs/authentication/email-password), [Source](https://better-auth.com/docs/concepts/email)

### 5.3 Password reset

Provide `emailAndPassword.sendResetPassword({ user, url, token }, request)` → client/server `requestPasswordReset({ email, redirectTo })`, then `resetPassword({ newPassword, token })`. Optional `revokeSessionsOnPasswordReset: true`. Docs advise not awaiting the email send ("to prevent timing attacks") and using `waitUntil` on serverless. [Source](https://better-auth.com/docs/authentication/email-password), [Source](https://better-auth.com/docs/concepts/email)

The deplacementapp already has a nodemailer-based `EmailService` (see gmail-integration-nodemailer.md) — it plugs directly into `sendVerificationEmail` / `sendResetPassword`.

---

## 6. Plugin System for a Multi-Role App

### 6.1 Access control / roles (admin plugin)

The **admin plugin** ships "roles & permissions" plus user-management endpoints (create/list/get/update user, set-role, ban/unban, impersonate, revoke sessions, remove user). It requires its own client plugin (`adminClient`). Admin access = role `admin` or ID in `adminUserIds`. A user can have **multiple roles, stored comma-separated** on the user row. [Source](https://better-auth.com/docs/plugins/admin)

Custom roles via `createAccessControl` (import from `better-auth/plugins/access` to keep bundles small) + `ac.newRole({ … })`; merge with `defaultStatements`/`adminAc.statements` to keep built-in permissions; pass `ac` + `roles` to both server plugin and client plugin:

```ts
import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  project: ["create", "share", "update", "delete"],
} as const;
export const ac = createAccessControl(statement);
export const user = ac.newRole({ project: ["create"] });
export const admin = ac.newRole({ project: ["create", "update"] });
export const myCustomRole = ac.newRole({ project: ["create", "update", "delete"], user: ["ban"] });
```

```ts
import { admin as adminPlugin } from "better-auth/plugins"
import { ac, admin, user, myCustomRole } from "@/auth/permissions"

export const auth = betterAuth({
  plugins: [adminPlugin({ ac, roles: { admin, user, myCustomRole } })],
});
```

[Source](https://better-auth.com/docs/plugins/admin)

**Mapping for deplacementapp roles** (EMPLOYEE / MANAGER / FINANCE_ADMIN / GENERAL_DIRECTION): define a statement over the app's resources (e.g. `demande`, `validation`, `user`, `report`) and create the four roles with `ac.newRole({…})`, then gate server code with the role/permission checks. The admin plugin's `setRole` endpoint and admin user-management then operate over these roles. Alternatively (without the admin plugin), roles can be a simple `user.additionalFields` enum with `input: false` (server-owned) — but then you get no built-in permission checks. [Source](https://better-auth.com/docs/plugins/admin), [Source](https://better-auth.com/docs/concepts/database)

### 6.2 Organization / multi-tenant (optional)

`organization()` plugin: orgs with `member`/`invitation` tables, roles per member, active-organization in session, teams (`teams: { enabled: true }`), full `organizationHooks` lifecycle (create/update/member-role/invitation/team hooks, `APIError` throwing to abort). Client plugin `organizationClient`. [Source](https://better-auth.com/docs/plugins/organization)

Relevant if deplacementapp wants per-company workspaces; for a single-tenant role app the admin plugin's roles are sufficient. Docs note: "By default, any user can create an organization" — restrictible via `allowUserToCreateOrganization`. [Source](https://better-auth.com/docs/plugins/organization)

### 6.3 Two-factor authentication

`twoFactor()` plugin: TOTP + email/phone OTP + backup codes + trusted devices (30-day trust), `two_factor` cookie, `twoFactorRedirect` flow on sign-in, schema = `twoFactorEnabled` on `user` + `twoFactor` table. Requires `appName` (TOTP issuer) and, for OTP, `otpOptions.sendOTP`. [Source](https://better-auth.com/docs/plugins/2fa)

### 6.4 Other plugins of note

Bearer tokens (API auth), API keys, SSO, JWT, username, magic link, passkey, email OTP, rate limiting (built-in, custom rules), i18n, captcha, multi-session — full list at [Source](https://better-auth.com/docs/plugins.md) (indexed in [llms.txt](https://better-auth.com/llms.txt)).

---

## 7. Sessions & Cookies

### 7.1 Session model

Cookie-based session management. `session` table fields: `id`, `token` ("also used as the session cookie"), `userId`, `expiresAt`, `ipAddress`, `userAgent`. Defaults: `expiresIn: 7 days`, sliding renewal after `updateAge: 1 day` (session expiration bumped to now + expiresIn when updateAge is reached); `freshAge: 1 day` for freshness-sensitive endpoints. All configurable via `session` option (`disableSessionRefresh`, `deferSessionRefresh` for read-replica GETs, etc.). [Source](https://better-auth.com/docs/concepts/session-management)

### 7.2 Cookie names

Default cookie prefix `better-auth`; format `` `${prefix}.${cookie_name}` ``:

- `better-auth.session_token` — the session token
- `better-auth.session_data` — signed session cache (when cookie caching enabled)
- `better-auth.dont_remember` — set when `rememberMe` is disabled
- 2FA plugin adds a `two_factor` cookie for in-flight 2FA state

All cookies are `httpOnly` and `secure` in production. Customizable via `advanced.cookiePrefix`, `advanced.cookies.session_token` (name + attributes), `advanced.useSecureCookies`, and `advanced.crossSubDomainCookies` (domain). **Secrets**: `BETTER_AUTH_SECRET` (≥32 chars, `openssl rand -base64 32`), `BETTER_AUTH_SECRETS` (plural) for rotation. [Source](https://better-auth.com/docs/concepts/cookies), [Source](https://better-auth.com/docs/installation)

### 7.3 Cookie caching / stateless mode

`session.cookieCache` (`enabled`, `maxAge`, `strategy: "compact" | "jwt" | "jwe"`) stores session data in a signed short-lived cookie, avoiding a DB hit per request; caveat: revoked sessions can linger up to `maxAge` on other devices. No database config at all → fully stateless mode (signed/encrypted cookie only); note the 2FA/org plugins generally need a DB. [Source](https://better-auth.com/docs/concepts/session-management), [Source](https://better-auth.com/docs/concepts/database)

### 7.4 Session management & revocation

Client/server: `getSession`, `useSession` (reactive), `listSessions`, `revokeSession({ token })`, `revokeOtherSessions`, `revokeSessions`, `updateSession` (custom fields only), and `changePassword({ …, revokeOtherSessions: true })`. Admin plugin adds `revokeUserSession` / `revokeUserSessions` per user. [Source](https://better-auth.com/docs/concepts/session-management), [Source](https://better-auth.com/docs/plugins/admin)

---

## 8. Migration Path from next-auth v5

### 8.1 Context: Auth.js is now maintained by the Better Auth team

**An official migration guide exists** (see 8.2), and — significantly — **Auth.js was absorbed into Better Auth in Sept 2025**:

- Better Auth announcement (2025-09-22): "Auth.js, formerly known as NextAuth.js, is now being maintained and overseen by Better Auth team… If you're using Auth.js/NextAuth.js today, you can continue doing so without disruption—we'll keep addressing security patches and urgent issues… But we strongly recommend new projects to start with Better Auth." [Source](https://www.better-auth.com/blog/authjs-joins-better-auth)
- Auth.js team's GitHub discussion (#13252, 2025-09-26): "the project's original scope started to show its limits… our pace slowed over the past year… maintenance will continue for security and urgent issues." [Source](https://github.com/nextauthjs/next-auth/discussions/13252)
- authjs.dev homepage now reads "The Auth.js project is now part of Better Auth." [Source](https://authjs.dev/)
- npm status of next-auth: `latest` = 4.24.15; v5 is still on the `beta` dist-tag (`5.0.0-beta.32`) — i.e. **next-auth@5 remains beta on npm**. [Source](https://www.npmjs.com/package/next-auth), [Source](https://registry.npmjs.org/next-auth) (dist-tags)

### 8.2 The official migration guide

"Migrating from Auth.js to Better Auth" — published at **https://better-auth.com/docs/guides/next-auth-migration-guide** and mirrored on the Auth.js docs site at **https://authjs.dev/getting-started/migrate-to-better-auth**. It opens with: "Since these projects have different design philosophies, the migration requires careful planning and work. If your current setup is working well, there's no urgent need to migrate." [Source](https://better-auth.com/docs/guides/next-auth-migration-guide), [Source](https://authjs.dev/getting-started/migrate-to-better-auth)

Practical differences covered by the guide:

| Aspect | Auth.js / next-auth | Better Auth |
|---|---|---|
| Config | `NextAuth({ providers: [GitHub] })` exporting `{ handlers, signIn, signOut, auth }` | `betterAuth({ … })` + `auth.api.*`; client via `createAuthClient()` |
| Route handler | `/app/api/auth/[...nextauth]/route.ts` exporting `handlers` | rename folder to `/app/api/auth/[...all]`, export `toNextJsHandler(auth)` |
| Client sign-in | `signIn("github")` from `next-auth/react` | `authClient.signIn.*` / `authClient.signUp.*` |
| Client sign-out | `signOut()` from `next-auth/react` | `authClient.signOut()` |
| Client session | `useSession()` from `next-auth/react` (needs `<SessionProvider>`) | `authClient.useSession()` (no provider wrapper needed) |
| Server session | `await auth()` | `await auth.api.getSession({ headers })` |
| Route protection | `auth` in middleware (edge) | `getSessionCookie` (cookie-only) or full validation in `proxy.ts` (Next.js 16) |

[Source](https://better-auth.com/docs/guides/next-auth-migration-guide), [Source](https://authjs.dev/getting-started/migrate-to-better-auth)

**Database schema differences** (guide's comparison table): user/email/emailVerified are **required** in Better Auth (optional in Auth.js); `emailVerified` is a **boolean** (Auth.js uses timestamp); session uses `token` + `expiresAt` (vs `sessionToken` + `expires`), adds `ipAddress`/`userAgent`; account uses camelCase, adds `accountId`/`providerId`/`password`, drops `type`/`token_type`/`session_state`; `VerificationToken` → `Verification` (single `id` PK, `value` instead of `token`). **Critical for credentials migration:** "passwords must be stored in the `Account` table… with the `providerId` set specifically to `"credential"`. Without this record, password-based sign-ins will fail." The guide notes Auth.js v4→v5 introduced no DB schema breaking changes, so a migration of existing data is mostly a column rename/restructure job. [Source](https://better-auth.com/docs/guides/next-auth-migration-guide)

### 8.3 What's not in the guide

The official guide does **not** cover next-auth-specific mechanics such as JWT session strategy equivalence, callbacks (`jwt`/`session`/`authorized`), or middleware matcher parity beyond the snippets above — for deplacementapp (v5 beta, database sessions, Drizzle adapter) the practical work is: new `auth.ts` + `auth-client.ts`, route rename, swapping `useSession`/`signIn`/`signOut` imports, replacing `getServerSession`/`auth()` calls with `auth.api.getSession`, mapping the existing users table into Better Auth's core schema (adding `emailVerified` boolean, `updatedAt`, account `password` rows), and deleting the next-auth adapter package.

---

## 9. Caveats & Known Issues

- **Docs URLs that 404 (do not exist)** — verified while researching:
  - `https://better-auth.com/docs/database/drizzle` → 404; real page: `/docs/adapters/drizzle`
  - `https://www.better-auth.com/docs/database/drizzle` → 404 (same)
  - `https://better-auth.com/docs/guides/email-password` → 404; real page: `/docs/authentication/email-password`
  - `https://better-auth.com/docs/plugins/access-control` → 404; access-control content lives in `/docs/plugins/admin`
  - The canonical URL list is https://better-auth.com/llms.txt.
- **Versioning**: stable is 1.6.x; 1.7.0-rc.1 is in prerelease with a dedicated upgrade guide (breaking changes around OAuth/OIDC/MCP/SAML/SCIM/proxy/adapters). [Source](https://github.com/better-auth/better-auth), [Source](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- **License**: MIT — no commercial restriction. [Source](https://github.com/better-auth/better-auth)
- **Telemetry**: "Since v1.3.5, Better Auth collects anonymous telemetry data about general usage if enabled" — **opt-in** (`telemetry: { enabled: true }` or `BETTER_AUTH_TELEMETRY=1`), disabled by default, auto-disabled in tests. [Source](https://better-auth.com/docs/reference/telemetry)
- **Database requirement**: most plugins require a database; the built-in CLI `migrate` command works only with the Kysely adapter — with Drizzle you must use drizzle-kit for migrations. [Source](https://better-auth.com/docs/concepts/database)
- **Secret hygiene**: `BETTER_AUTH_SECRET` must be ≥32 chars high-entropy; rotation via `BETTER_AUTH_SECRETS` (plural). [Source](https://better-auth.com/docs/installation)
- **Edge middleware**: before Next.js 15.2, middleware (edge) cannot do DB validation — cookie-only checks only; Next.js 16 fixes this via Node-runtime proxy. [Source](https://better-auth.com/docs/integrations/next)
- **Server Action cookies**: need the `nextCookies` plugin, placed last in the plugins array. [Source](https://better-auth.com/docs/integrations/next)

---

## 10. Applicability to deplacementapp (summary)

- **Stack fit**: Next.js 16 App Router is explicitly supported (incl. proxy-based route protection); Drizzle + Postgres is a first-class adapter with CLI schema generation wired into the existing `drizzle-kit` migration flow.
- **Role model fit**: the admin plugin's `createAccessControl`/`newRole` maps directly onto EMPLOYEE/MANAGER/FINANCE_ADMIN/GENERAL_DIRECTION; roles are server-owned fields, preventing self-escalation.
- **Email flows**: `sendVerificationEmail`/`sendResetPassword` plug straight into the existing nodemailer `EmailService`.
- **Migration risk**: an official, maintained migration guide exists (also mirrored on authjs.dev); the main data work is restructuring the users/sessions/accounts tables and seeding `account` rows with `providerId = "credential"`. Auth.js (next-auth) is now maintained by the Better Auth team and is effectively in maintenance mode, with next-auth@5 still on the npm beta tag.

---

## Sources

All sources are official/primary (better-auth.com docs, better-auth GitHub, npm registry, authjs.dev / next-auth GitHub).

| Topic | URL |
|---|---|
| Better Auth docs index (canonical URL list) | https://better-auth.com/llms.txt |
| Introduction / features | https://better-auth.com/docs/introduction |
| Installation (env vars, instance, adapter, handler, client) | https://better-auth.com/docs/installation |
| Comparison page | https://better-auth.com/docs/comparison |
| Next.js integration (route, RSC/Server Actions, nextCookies, middleware/proxy, Next.js 16) | https://better-auth.com/docs/integrations/next |
| Drizzle ORM adapter (wiring, CLI, joins, naming) | https://better-auth.com/docs/adapters/drizzle |
| Database concepts (core schema fields, custom tables, additionalFields, ID generation, secondary storage) | https://better-auth.com/docs/concepts/database |
| CLI (generate/migrate/init/info/secret) | https://better-auth.com/docs/concepts/cli |
| Session management (expiry, caching, stateless, revocation) | https://better-auth.com/docs/concepts/session-management |
| Cookies (names, prefix, security, cross-subdomain, ITP) | https://better-auth.com/docs/concepts/cookies |
| Email & password auth (sign-up/in, verification, reset, hashing) | https://better-auth.com/docs/authentication/email-password |
| Email concepts (verification, reset emails) | https://better-auth.com/docs/concepts/email |
| Organization plugin | https://better-auth.com/docs/plugins/organization |
| Admin plugin (roles, permissions, access control) | https://better-auth.com/docs/plugins/admin |
| Two-factor plugin | https://better-auth.com/docs/plugins/2fa |
| Plugins overview | https://better-auth.com/docs/plugins.md |
| FAQ | https://better-auth.com/docs/reference/faq |
| Telemetry | https://better-auth.com/docs/reference/telemetry |
| 1.6 → 1.7 upgrade guide | https://better-auth.com/docs/guides/1-7-upgrade-guide |
| **Migration guide (Better Auth site)** | https://better-auth.com/docs/guides/next-auth-migration-guide |
| **Migration guide (authjs.dev mirror)** | https://authjs.dev/getting-started/migrate-to-better-auth |
| Auth.js homepage (now part of Better Auth) | https://authjs.dev/ |
| "Auth.js is now part of Better Auth" announcement | https://www.better-auth.com/blog/authjs-joins-better-auth |
| Auth.js team announcement (GitHub discussion) | https://github.com/nextauthjs/next-auth/discussions/13252 |
| better-auth npm (version 1.6.23, keywords, readme) | https://www.npmjs.com/package/better-auth |
| better-auth GitHub (stars, license, releases) | https://github.com/better-auth/better-auth |
| next-auth npm (latest 4.24.15, ISC, v5 beta) | https://www.npmjs.com/package/next-auth |
| next-auth npm registry dist-tags (beta = 5.0.0-beta.32) | https://registry.npmjs.org/next-auth |

**Verified 404s** (pages do not exist): `https://better-auth.com/docs/database/drizzle`, `https://www.better-auth.com/docs/database/drizzle`, `https://better-auth.com/docs/guides/email-password`, `https://better-auth.com/docs/plugins/access-control`.

*Schema snippet in §4.3 was generated locally with the official CLI (`npx auth@latest generate`, better-auth@1.6.23, provider "pg") — same output the docs' Drizzle tab renders.*
