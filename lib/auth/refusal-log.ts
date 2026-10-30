/**
 * The refusal log — the server-side half of #247.
 *
 * A refused Google sign-in leaves the deployment as a redirect to
 * `/login?error=<code>&error_description=<…>`.  The browser can show the code
 * only outside production, so in production that redirect is the **last** place
 * the raw code exists on the server — and it used to be the only place, meaning
 * the next `access_denied` or `state_mismatch` had to be reproduced against the
 * live deployment to be diagnosed.
 *
 * One line per refusal here turns that into a log grep.  The rule is one line
 * for **every** code, mapped or not: a mapped code is the common case, and an
 * unmapped one is exactly the occurrence worth grepping for.
 */

/** The raw code and description a refusal redirect carries. */
export interface RefusalTrace {
  /** The engine's machine-readable code, verbatim — never translated. */
  code: string
  /** Google's or the gate's own description, when the redirect carried one. */
  errorDescription: string | null
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * Read the refusal off a redirect response, or `null` when the response is not
 * a refusal (a successful callback to `/`, an ordinary response, a redirect
 * without an `error` parameter).
 */
export function refusalFromRedirect(response: Response): RefusalTrace | null {
  if (!REDIRECT_STATUSES.has(response.status)) return null
  const location = response.headers.get("location")
  if (!location) return null

  const url = new URL(location, "http://localhost")
  const code = url.searchParams.get("error")
  if (!code) return null

  return {
    code,
    errorDescription: url.searchParams.get("error_description"),
  }
}

/**
 * Log one line carrying the raw code of a refusal redirect.  A no-op for any
 * other response.
 */
export function logRefusal(response: Response): void {
  const refusal = refusalFromRedirect(response)
  if (!refusal) return
  console.warn("[GoogleRefusal] connexion Google refusée", {
    code: refusal.code,
    error_description: refusal.errorDescription,
  })
}

/**
 * Wrap the auth handler so every refusal it returns is logged once.  Wired
 * into the auth route (`app/api/auth/[...all]/route.ts`), it sits on the one
 * path every OAuth failure passes through — engine-originated or gate-originated.
 *
 * The log is observability, never part of the contract: if the sink throws,
 * the refusal still redirects.
 */
export function withRefusalLog(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    const response = await handler(request)
    try {
      logRefusal(response)
    } catch {
      /* a broken log sink must not turn a 302 into a 500 */
    }
    return response
  }
}
