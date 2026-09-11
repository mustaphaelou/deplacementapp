import { sql } from "drizzle-orm"
import type {
  ValidateUserInfoResult,
  ValidateUserInfoSource,
} from "better-auth"
import type { DrizzleDb } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { GOOGLE_REFUSAL_CODES, googleRefusalMessage } from "./google-refusals"
import type { GoogleRefusalCode } from "./google-refusals"

/**
 * The part of the `validateUserInfo` payload the Google gate reads.
 */
export interface GoogleGateInput {
  user: {
    email?: string | null | undefined
    [key: string]: unknown
  }
  source: ValidateUserInfoSource
}

/**
 * The Google identity gate, wired into Better Auth as
 * `user.validateUserInfo`.
 *
 * The engine calls it before a Utilisateur would be created, before a Google
 * account would be linked and before a returning Utilisateur signs in; a
 * refusal therefore never leaves a session behind.  Only Google OAuth sources
 * are examined — anything else is allowed (return `undefined`).
 *
 * A refusal is **returned**, never thrown: returning `{ error, errorDescription }`
 * makes the engine redirect with the code and the French message, while a throw
 * collapses into the generic `validation_failed` engine error and loses the code.
 */
export function createGoogleGate(db: DrizzleDb) {
  return async function validateGoogleUserInfo(
    data: GoogleGateInput
  ): Promise<ValidateUserInfoResult | undefined> {
    if (data.source.oauth?.providerId !== "google") return

    const email = typeof data.user.email === "string" ? data.user.email : null
    // Refusal contract: the gate refuses only an identity it can match.  A
    // missing / non-string e-mail keeps the engine's own codes
    // (`email_not_found`, …) and is handled by the generic fallback message.
    if (!email) return

    const [utilisateur] = await db
      .select()
      .from(utilisateurs)
      .where(sql`lower(${utilisateurs.email}) = lower(${email})`)
      .limit(1)

    if (utilisateur) {
      if (!utilisateur.actif) {
        return refuse(GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE)
      }
      if (!utilisateur.googleAuthEnabled) {
        return refuse(GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE)
      }
      return
    }
    return refuse(GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE)
  }
}

function refuse(code: GoogleRefusalCode): ValidateUserInfoResult {
  return { error: code, errorDescription: googleRefusalMessage(code) }
}
