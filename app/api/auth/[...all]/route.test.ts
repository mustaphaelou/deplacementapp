/**
 * The auth route's refusal-log wiring (#247).
 *
 * The log itself is covered twice over — `refusal-log.test.ts` for the seam,
 * `google-callback.test.ts` for the real engine's redirects — but both drive
 * the seam they built themselves.  Nothing imported the route module, so
 * deleting `withRefusalLog` from the route left every test green: the logging
 * would have been dead in production and nothing would have said so.
 *
 * This suite closes that gap by importing the route's own `GET`/`POST`.
 */
import { describe, it, expect, vi, afterEach } from "vitest"

/** A refusal redirect as the engine produces it. */
function refusalRedirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}

/** The `console.warn` calls the refusal log emitted. */
function refusalLines(warn: ReturnType<typeof vi.spyOn>) {
  return warn.mock.calls.filter(
    (call: unknown[]) =>
      typeof call[0] === "string" && call[0].includes("GoogleRefusal")
  )
}

/** A stubbed engine: the route's `auth.handler` never reaches a database. */
const engine = {
  handler: vi.fn(async (request: Request) => {
    const url = new URL(request.url)
    if (url.searchParams.has("refused")) {
      return refusalRedirect("/login?error=access_denied&error_description=x")
    }
    if (url.searchParams.has("plain")) return refusalRedirect("/")
    return new Response("{}", { status: 200 })
  }),
}

vi.mock("@/lib/auth/server", () => ({ auth: engine }))

afterEach(() => {
  vi.restoreAllMocks()
  engine.handler.mockClear()
})

describe("the auth route logs refusals (#247)", () => {
  it("exports GET and POST", async () => {
    const route = await import("@/app/api/auth/[...all]/route")

    expect(typeof route.GET).toBe("function")
    expect(typeof route.POST).toBe("function")
  })

  it("logs the raw code when GET is handed a refusal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { GET } = await import("@/app/api/auth/[...all]/route")

    const response = await GET(
      new Request("http://localhost:3000/api/auth/callback/google?refused=1")
    )

    expect(response.status).toBe(302)
    const lines = refusalLines(warn)
    expect(lines).toHaveLength(1)
    expect(lines[0][1]).toMatchObject({ code: "access_denied" })
  })

  it("logs the raw code when POST is handed a refusal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { POST } = await import("@/app/api/auth/[...all]/route")

    await POST(
      new Request("http://localhost:3000/api/auth/callback/google?refused=1")
    )

    expect(refusalLines(warn)).toHaveLength(1)
  })

  it("stays silent on a redirect that is not a refusal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { GET } = await import("@/app/api/auth/[...all]/route")

    await GET(new Request("http://localhost:3000/api/auth/session?plain=1"))

    expect(refusalLines(warn)).toHaveLength(0)
  })

  it("passes the engine's own response through untouched", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { GET } = await import("@/app/api/auth/[...all]/route")
    const request = new Request(
      "http://localhost:3000/api/auth/callback/google?refused=1"
    )

    const response = await GET(request)

    expect(engine.handler).toHaveBeenCalledWith(request)
    expect(response.headers.get("location")).toBe(
      "/login?error=access_denied&error_description=x"
    )
  })
})
