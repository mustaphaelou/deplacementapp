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
 * condition rather than a Utilisateur's standing.
 *
 * Two provenances, deliberately distinguished:
 *
 * - **Google passthrough** — `access_denied` is Google's own OAuth error code,
 *   forwarded verbatim by the engine's callback (`if (error) redirectOnError
 *   (error, error_description)`).  It belongs to no engine list, and neither
 *   would any other code Google may add: this one is an open passthrough, not a
 *   pinned member.
 * - **Engine codes** — the rest are read from the installed engine:
 *   `dist/oauth2/errors.mjs` (`OAUTH_CALLBACK_ERROR_CODES`), `dist/state.mjs`
 *   (the `StateError` codes) and `dist/api/routes/callback.mjs` (the codes it
 *   redirects with inline).  `google-refusals.test.ts` re-reads those files and
 *   fails when a code this map names is no longer emitted, so an upgrade that
 *   renames one cannot silently revert it to the generic message.
 */
export const GOOGLE_ENGINE_REFUSAL_MESSAGES = {
  // Google's own refusal, forwarded by the engine's callback.  On a consent
  // screen left in *Testing*, Google refuses any address that is not a test
  // user — a one-line console fix that used to read as an app failure.
  access_denied:
    "Google a refusé l'autorisation de connexion. Si vous n'avez pas été autorisé dans la configuration Google de l'application, contactez votre administrateur.",
  // The engine's token exchange failed: the code was already used, expired or
  // rejected.  The OAuth round trip did not complete; retrying starts a new one.
  invalid_code:
    "Le code d'autorisation renvoyé par Google est invalide ou a expiré. Réessayez de vous connecter avec Google.",
  // The stored OAuth state could not be matched, or was already gone (the
  // engine's `StateError` code `state_mismatch`): the state cookie did not
  // come back, the verification row was consumed by another sign-in, or the
  // round trip outran the state's 10-minute life.  The engine also folds its
  // stricter `state_security_mismatch` into this code at the redirect, so a
  // genuine mismatch arrives here too.
  state_mismatch:
    "La session de connexion Google a expiré ou a été remplacée par une autre tentative. Relancez la connexion Google.",
  // The callback arrived with no `state` parameter at all — the provider
  // dropped it, or the request never came from a sign-in this deployment
  // started.  (An *expired* state is `state_mismatch`, not this.)
  state_not_found:
    "La connexion Google n'a pas pu être vérifiée : aucune session de connexion n'a été reçue. Relancez la connexion Google.",
  // The callback request itself was malformed or the redirect URI is not
  // accepted — a deployment misconfiguration, not a Utilisateur's doing.
  invalid_callback_request:
    "L'adresse de retour de la connexion Google est mal configurée sur ce serveur. Contactez votre administrateur.",
} as const

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
