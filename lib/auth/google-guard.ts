import { APIError } from "better-auth/api"
import { eq } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"

export const GOOGLE_VETO_REASONS = {
  UTILISATEUR_INTROUVABLE: "utilisateur_introuvable",
  UTILISATEUR_DESACTIVE: "utilisateur_desactive",
  GOOGLE_NON_ACTIVE: "google_non_active",
} as const

export type GoogleVetoReason =
  (typeof GOOGLE_VETO_REASONS)[keyof typeof GOOGLE_VETO_REASONS]

/**
 * Veto a Google social sign-in unless the Utilisateur exists, is active,
 * and has Google sign-in enabled.
 *
 * Throws a 403 APIError carrying the refusal reason as message.  This runs
 * server-side before Better Auth issues a session, so a vetoed sign-in never
 * produces a session.
 */
export async function assertGoogleSignInAllowed(
  db: DrizzleDb,
  email: string | null | undefined
): Promise<void> {
  if (!email) {
    throw new APIError("FORBIDDEN", {
      message: GOOGLE_VETO_REASONS.UTILISATEUR_INTROUVABLE,
    })
  }
  const [utilisateur] = await db
    .select()
    .from(utilisateurs)
    .where(eq(utilisateurs.email, email))
    .limit(1)
  if (!utilisateur) {
    throw new APIError("FORBIDDEN", {
      message: GOOGLE_VETO_REASONS.UTILISATEUR_INTROUVABLE,
    })
  }
  if (!utilisateur.actif) {
    throw new APIError("FORBIDDEN", {
      message: GOOGLE_VETO_REASONS.UTILISATEUR_DESACTIVE,
    })
  }
  if (!utilisateur.googleAuthEnabled) {
    throw new APIError("FORBIDDEN", {
      message: GOOGLE_VETO_REASONS.GOOGLE_NON_ACTIVE,
    })
  }
}
