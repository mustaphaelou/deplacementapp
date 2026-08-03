import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs"
import type { DrizzleDb } from "../../db"
import { db } from "../../db"
import { assertGoogleSignInAllowed } from "./google-guard"

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
 * hashes are bcryptjs at cost 12 (the legacy `motDePasse` hashes keep
 * verifying); Google sign-in does not auto-provision and is vetoed by
 * `assertGoogleSignInAllowed`.  `nextCookies` is registered last.
 */
export function createAuth(db: DrizzleDb, options: BetterAuthOptions = {}) {
  return betterAuth({
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
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
        clientId:
          options.google?.clientId ?? process.env.AUTH_GOOGLE_ID ?? "",
        clientSecret:
          options.google?.clientSecret ?? process.env.AUTH_GOOGLE_SECRET ?? "",
        disableImplicitSignUp: true,
        mapProfileToUser: async (profile) => {
          await assertGoogleSignInAllowed(db, profile.email)
          return {}
        },
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
        actif: { type: "boolean", input: false },
        googleAuthEnabled: { type: "boolean", input: false },
      },
    },
    plugins: [nextCookies()],
  })
}

export const auth = createAuth(db)
