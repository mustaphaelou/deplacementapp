/**
 * The refusal vocabulary of the Google gate — the single home for the codes a
 * refused Google sign-in redirects with and the French messages they carry.
 *
 * Dependency-free on purpose: the login page (a client component) renders
 * these messages and must not pull the database or the auth engine in.
 */

/** The machine-readable codes the gate refuses with (and the engine redirects with). */
export const GOOGLE_REFUSAL_CODES = {
  UTILISATEUR_INTROUVABLE: "utilisateur_introuvable",
  UTILISATEUR_DESACTIVE: "utilisateur_desactive",
  GOOGLE_NON_ACTIVE: "google_non_active",
} as const

export type GoogleRefusalCode =
  (typeof GOOGLE_REFUSAL_CODES)[keyof typeof GOOGLE_REFUSAL_CODES]

/** The French message shown for each refusal code. */
export const GOOGLE_REFUSAL_MESSAGES = {
  [GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE]:
    "Aucun compte ne correspond à cette adresse Google. Utilisez votre adresse professionnelle ou contactez votre administrateur.",
  [GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE]:
    "Votre compte est désactivé. Contactez votre administrateur.",
  [GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE]:
    "La connexion Google n'est pas activée pour votre compte. Contactez votre administrateur.",
} as const satisfies Record<GoogleRefusalCode, string>

/**
 * The message for anything the gate did not refuse with a known code —
 * engine-originated codes (`signup_disabled`, `account_not_linked`, …) and
 * unexpected failures.
 */
export const GOOGLE_REFUSAL_FALLBACK_MESSAGE =
  "La connexion avec Google a échoué. Réessayez ou contactez votre administrateur."

/**
 * Map a refusal code to its French message. Unknown, missing and non-string
 * codes get {@link GOOGLE_REFUSAL_FALLBACK_MESSAGE}.
 */
export function googleRefusalMessage(code: string | null | undefined): string {
  if (
    code &&
    Object.prototype.hasOwnProperty.call(GOOGLE_REFUSAL_MESSAGES, code)
  ) {
    return GOOGLE_REFUSAL_MESSAGES[code as GoogleRefusalCode]
  }
  return GOOGLE_REFUSAL_FALLBACK_MESSAGE
}
