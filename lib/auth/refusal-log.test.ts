/**
 * The refusal log seam — the server-side half of #247.
 *
 * Every refusal the engine redirects with carries its code, mapped by the app
 * or not; this seam turns each of them into exactly one log line carrying the
 * raw code, so the next occurrence is a log grep instead of a live probe of
 * the deployment.
 *
 * Driven through the exported seam (a real `Response`, a real handler
 * function) — the vitest environment is node, and no database, auth instance
 * or DOM is needed to prove what the seam logs and what it leaves alone.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { refusalFromRedirect, logRefusal, withRefusalLog } from "./refusal-log"

const TIMEOUT = 10_000

/** A refusal redirect as the engine produces it: 302, no body, a Location
 * carrying `error` and, for a gate refusal, the French description. */
function refusalRedirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("refusalFromRedirect (reading a redirect, pure)", () => {
  it("reads the raw code and the description off a refusal redirect", () => {
    expect(
      refusalFromRedirect(
        refusalRedirect(
          "/login?error=access_denied&error_description=The+user+denied+the+request."
        )
      )
    ).toEqual({
      code: "access_denied",
      errorDescription: "The user denied the request.",
    })
  })

  it("reads a gate refusal, whose description is the French message", () => {
    expect(
      refusalFromRedirect(
        refusalRedirect(
          "/login?error=utilisateur_desactive&error_description=Votre+compte+est+d%C3%A9sactiv%C3%A9."
        )
      )
    ).toEqual({
      code: "utilisateur_desactive",
      errorDescription: "Votre compte est désactivé.",
    })
  })

  it("reads a code that arrived without a description", () => {
    expect(
      refusalFromRedirect(refusalRedirect("/login?error=state_not_found"))
    ).toEqual({ code: "state_not_found", errorDescription: null })
  })

  it("reads an absolute redirect target, as the engine emits it", () => {
    const response = refusalRedirect(
      "https://app.exemple.ma/login?error=invalid_code&error_description=x"
    )

    expect(refusalFromRedirect(response)?.code).toBe("invalid_code")
  })

  it("ignores a redirect that carries no refusal", () => {
    expect(refusalFromRedirect(refusalRedirect("/demandes"))).toBeNull()
  })

  it("ignores a successful callback redirect", () => {
    // The happy path lands on `/` with no error parameter; logging it would
    // bury the refusals in noise.
    expect(
      refusalFromRedirect(refusalRedirect("http://localhost:3000/?from=google"))
    ).toBeNull()
  })

  it("ignores a non-redirect response", () => {
    const ok = new Response("{}", { status: 200 })
    expect(refusalFromRedirect(ok)).toBeNull()

    const errored = new Response("{}", { status: 500 })
    expect(refusalFromRedirect(errored)).toBeNull()
  })

  it("ignores a redirect with neither error nor description", () => {
    expect(refusalFromRedirect(refusalRedirect("/login"))).toBeNull()
  })
})

describe("logRefusal (one line per refusal)", () => {
  it("logs the raw code of a refusal the app has no message for", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logRefusal(
      refusalRedirect(
        "/login?error=unable_to_get_user_info&error_description=boom"
      )
    )

    expect(warn).toHaveBeenCalledTimes(1)
    const [line, payload] = warn.mock.calls[0]
    expect(line).toContain("GoogleRefusal")
    expect(payload).toEqual({
      code: "unable_to_get_user_info",
      error_description: "boom",
    })
  })

  it("logs a mapped gate refusal too — mapped or not, every code is logged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logRefusal(
      refusalRedirect(
        "/login?error=utilisateur_introuvable&error_description=Aucun+compte"
      )
    )

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][1]).toEqual({
      code: "utilisateur_introuvable",
      error_description: "Aucun compte",
    })
  })

  it("logs a code with no description as null, never undefined", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logRefusal(refusalRedirect("/login?error=state_mismatch"))

    expect(warn.mock.calls[0][1]).toEqual({
      code: "state_mismatch",
      error_description: null,
    })
  })

  it("stays silent on a redirect that is not a refusal", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    logRefusal(refusalRedirect("/demandes"))

    expect(warn).not.toHaveBeenCalled()
  })
})

describe(
  "withRefusalLog (the callback-path seam)",
  () => {
    it("returns the handler's own response, untouched", async () => {
      const handler = vi.fn(async () => refusalRedirect("/login?error=x"))
      const request = new Request(
        "http://localhost:3000/api/auth/callback/google"
      )
      const wrapped = withRefusalLog(handler)

      const response = await wrapped(request)

      expect(handler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(302)
      expect(response.headers.get("location")).toBe("/login?error=x")
    })

    it("logs exactly one line for a refusal the handler returned", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const wrapped = withRefusalLog(async () =>
        refusalRedirect("/login?error=access_denied&error_description=denied")
      )

      await wrapped(
        new Request("http://localhost:3000/api/auth/callback/google")
      )

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][1]).toEqual({
        code: "access_denied",
        error_description: "denied",
      })
    })

    it("stays silent on a successful callback", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const wrapped = withRefusalLog(async () => refusalRedirect("/"))

      await wrapped(
        new Request("http://localhost:3000/api/auth/callback/google")
      )

      expect(warn).not.toHaveBeenCalled()
    })

    it("never lets a logging failure break the sign-in response", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {
        throw new Error("the log sink is down")
      })
      const wrapped = withRefusalLog(async () =>
        refusalRedirect("/login?error=invalid_code")
      )

      // A refused sign-in must still redirect: the log is observability, not
      // part of the contract.  A thrown logger must not turn a 302 into a 500.
      const response = await wrapped(
        new Request("http://localhost:3000/api/auth/callback/google")
      )
      expect(response.status).toBe(302)
    })
  },
  TIMEOUT
)
