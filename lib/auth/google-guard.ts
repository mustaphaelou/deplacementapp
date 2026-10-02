import { sql } from "drizzle-orm"
import type {
  ValidateUserInfoResult,
  ValidateUserInfoSource,
} from "better-auth"
import type { DrizzleDb } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { peutAgir } from "../utilisateur-service"
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
      // The activity answer is ASKED of the Utilisateur module's reader, not
      // read off the row this gate already holds (#315).  The cost is a second
      // call to learn one field of a row already in hand — paid knowingly,
      // once per sign-in attempt, because the alternative is a third spelling
      // of a rule the Utilisateur module now owns in one place.
      //
      // `db` is the handle the gate was built with, and it is passed through so
      // the reader reads through the same database this gate reads (the tests
      // build the gate on an in-process Postgres).  The refusal vocabulary is
      // untouched: the same cause is named for the same case.
      if (!(await peutAgir(utilisateur.id, db))) {
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
