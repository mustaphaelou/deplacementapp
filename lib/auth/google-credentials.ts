/**
 * The deployment's Google credentials, as the login surface cares about them.
 *
 * The Google button renders only on deployments that can actually complete a
 * Google sign-in — with either half of the pair missing, the button would
 * dead-end on a Google error page and must not render at all.  The auth engine
 * reads the same variables (`lib/auth/better-auth.ts`); this module is a pure
 * env read with no imports and no side effects so the public status route can
 * expose the fact without pulling the engine in.
 */
export function googleCredentialsConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim()
  )
}
