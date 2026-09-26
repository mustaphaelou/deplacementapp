import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs"
import type { DrizzleDb } from "../../db"
import { db } from "../../db"
import { createGoogleGate } from "./google-guard"

export const BCRYPT_COST = 12

export interface BetterAuthOptions {
  secret?: string
  google?: {
    clientId: string
    clientSecret: string
  }
}

/**
 * Build the Better Auth instance for a given database.
 *
 * The Drizzle adapter runs on the existing `db`; the Better Auth `user` model
 * is mapped onto the existing `utilisateurs` table (domain fields are
 * server-owned `additionalFields`).  Email+password is a closed pool whose
 * hashes are bcryptjs at cost 12 (hashes seeded from the legacy column during
 * the T3 data migration keep verifying); Google sign-in does not auto-provision
 * and is gated by `user.validateUserInfo` (see `google-guard.ts`), which refuses
 * a non-matching identity by returning a coded refusal the engine redirects
 * with.  `nextCookies` is registered last.
 *
 * `onAPIError.errorURL` sends **every** refusal to the login page, including
 * the ones raised before the OAuth state parses (#247).  The engine defaults
 * that URL to `${baseURL}/error`, its own error page — and in production that
 * page redirects to `/?error=…`, the application home.  So without this line a
 * `state_not_found` or a `state_mismatch` (a state cookie that never came back,
 * a second sign-in in another tab replacing it) left the user on a page that
 * renders no French message at all, and the mapped message for those codes was
 * unreachable.  Verified against 1.7.4 with the callback seam.
 */
export function createAuth(db: DrizzleDb, options: BetterAuthOptions = {}) {
  return betterAuth({
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    onAPIError: { errorURL: "/login" },
    database: drizzleAdapter(db, { provider: "pg", camelCase: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: (password: string) => bcryptHash(password, BCRYPT_COST),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          bcryptCompare(password, hash),
      },
    },
    socialProviders: {
      google: {
        clientId: options.google?.clientId ?? process.env.AUTH_GOOGLE_ID ?? "",
        clientSecret:
          options.google?.clientSecret ?? process.env.AUTH_GOOGLE_SECRET ?? "",
        disableImplicitSignUp: true,
      },
    },
    user: {
      modelName: "utilisateurs",
      fields: {
        name: "nom",
        image: "avatarUrl",
        createdAt: "creeLe",
        updatedAt: "modifieLe",
      },
      additionalFields: {
        prenom: { type: "string", input: false },
        poste: { type: "string", input: false },
        role: { type: "string", input: false },
        departementId: { type: "string", input: false },
        societeId: { type: "string", input: false },
        actif: { type: "boolean", input: false },
        googleAuthEnabled: { type: "boolean", input: false },
      },
      validateUserInfo: createGoogleGate(db),
    },
    plugins: [nextCookies()],
  })
}

export const auth = createAuth(db)
