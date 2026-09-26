/**
 * The refusal vocabulary of the Google gate — the single home for the codes a
 * refused Google sign-in redirects with and the French messages they carry.
 *
 * Two vocabularies live here, and the difference matters:
 *
 * - the **gate's own** codes (`GOOGLE_REFUSAL_CODES`), returned by the identity
 *   gate when the identity is not an active, Google-enabled Utilisateur;
 * - the **engine's** codes, raised by Better Auth or forwarded from Google for
 *   a condition the app does not own — a refused consent screen, an expired or
 *   mismatched OAuth round trip, a misconfigured callback.
 *
 * Before #247 only the first was mapped, and every engine code collapsed into
 * one generic string.  On the live deployment that made a Google consent-screen
 * rejection (`access_denied`: the consent screen is in *Testing* and the
 * signing-in address is not a test user) indistinguishable from a bug in the
 * app — diagnosing it meant probing the deployment by hand.
 *
 * Dependency-free on purpose: the login page (a client component) renders
 * these messages and must not pull the database or the auth engine in.
 */

/** The machine-readable codes the gate itself refuses with. */
export const GOOGLE_REFUSAL_CODES = {
  UTILISATEUR_INTROUVABLE: "utilisateur_introuvable",
  UTILISATEUR_DESACTIVE: "utilisateur_desactive",
  GOOGLE_NON_ACTIVE: "google_non_active",
} as const

export type GoogleRefusalCode =
  (typeof GOOGLE_REFUSAL_CODES)[keyof typeof GOOGLE_REFUSAL_CODES]

/**
 * The engine-originated codes, each naming a **Google-side or deployment**
 * condition rather than a Utilisateur's standing.  Pinned to the codes observed
 * in Better Auth 1.7.4 (`dist/oauth2/errors.mjs`, `dist/api/routes/callback.mjs`,
 * `dist/state.mjs`); that list is not a stable public API, so anything outside
 * it still takes the generic fallback below.
 */
export const GOOGLE_ENGINE_REFUSAL_MESSAGES = {
  // Google's own refusal, forwarded by the engine's callback
  // (`if (error) redirectOnError(error, error_description)`).  On a consent
  // screen left in *Testing*, Google refuses any address that is not a test
  // user — a one-line console fix that used to read as an app failure.
  access_denied:
    "Google a refusé l'autorisation de connexion. Si vous n'avez pas été autorisé dans la configuration Google de l'application, contactez votre administrateur.",
  // The engine's token exchange failed: the code was already used, expired or
  // rejected.  The OAuth round trip did not complete; retrying starts a new one.
  invalid_code:
    "Le code d'autorisation renvoyé par Google est invalide ou a expiré. Réessayez de vous connecter avec Google.",
  // The stored OAuth state does not match the one that started the round trip
  // (or its cookie was replaced by another sign-in in another tab).
  state_mismatch:
    "La session de connexion Google ne correspond pas à celle qui a été ouverte. Relancez la connexion Google.",
  // No state at all: it expired (10 minutes), or the state cookie did not make
  // the round trip back to this deployment.
  state_not_found:
    "La session de connexion Google est introuvable ou a expiré. Relancez la connexion Google.",
  // The callback request itself was malformed or the redirect URI is not
  // accepted — a deployment misconfiguration, not a Utilisateur's doing.
  invalid_callback_request:
    "L'adresse de retour de la connexion Google est mal configurée sur ce serveur. Contactez votre administrateur.",
} as const

export type GoogleEngineRefusalCode =
  keyof typeof GOOGLE_ENGINE_REFUSAL_MESSAGES

/** The French message shown for each refusal code. */
export const GOOGLE_REFUSAL_MESSAGES = {
  [GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE]:
    "Aucun compte ne correspond à cette adresse Google. Utilisez votre adresse professionnelle ou contactez votre administrateur.",
  [GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE]:
    "Votre compte est désactivé. Contactez votre administrateur.",
  [GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE]:
    "La connexion Google n'est pas activée pour votre compte. Contactez votre administrateur.",
} as const satisfies Record<GoogleRefusalCode, string>

/** Every code this module can name — the gate's own and the engine's. */
const MAPPED_REFUSAL_MESSAGES: Record<string, string> = {
  ...GOOGLE_REFUSAL_MESSAGES,
  ...GOOGLE_ENGINE_REFUSAL_MESSAGES,
}

/**
 * The message for anything neither vocabulary names — an engine code outside
 * the pinned set, a missing or non-string code, an unexpected failure.
 *
 * It is a last resort, never the only thing available: an unmapped code keeps
 * its raw value in the URL (see `stripRefusalParams`) and is logged
 * server-side (`lib/auth/refusal-log.ts`).
 */
export const GOOGLE_REFUSAL_FALLBACK_MESSAGE =
  "La connexion avec Google a échoué. Réessayez ou contactez votre administrateur."

/**
 * Whether this module has its own message for the code.  Decides the fate of
 * the URL parameter: a code that was **rendered** is a zombie parameter and is
 * stripped; a code that was **not** rendered is the only diagnostic left and
 * is kept.
 */
export function isMappedGoogleRefusalCode(
  code: string | null | undefined
): boolean {
  return (
    !!code &&
    Object.prototype.hasOwnProperty.call(MAPPED_REFUSAL_MESSAGES, code)
  )
}

/**
 * Map a refusal code to its French message. Unknown, missing and non-string
 * codes get {@link GOOGLE_REFUSAL_FALLBACK_MESSAGE}.
 */
export function googleRefusalMessage(code: string | null | undefined): string {
  if (isMappedGoogleRefusalCode(code)) {
    return MAPPED_REFUSAL_MESSAGES[code as string]
  }
  return GOOGLE_REFUSAL_FALLBACK_MESSAGE
}
