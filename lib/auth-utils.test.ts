import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

describe("requireAuth", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  async function getRequireAuth() {
    return (await import("@/lib/auth-utils")).requireAuth
  }

  it("returns ok:false when auth() returns null", async () => {
    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue(null)

    const requireAuth = await getRequireAuth()
    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(401)
      const body = await result.response.json()
      expect(body.error).toBe("Non autorisé")
    }
  })

  it("returns ok:false when session has no user", async () => {
    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({})

    const requireAuth = await getRequireAuth()
    const result = await requireAuth()

    expect(result.ok).toBe(false)
  })

  it("returns ok:true with AuthUser when auth succeeds", async () => {
    const userFixture = {
      id: "user-1",
      email: "jean@example.com",
      name: "Jean Dupont",
      role: "EMPLOYEE",
      departementId: "dep-1",
      departement: "IT",
      poste: "Développeur",
    }

    const { auth } = await import("@/lib/auth")
    ;(auth as any).mockResolvedValue({ user: userFixture })

    const requireAuth = await getRequireAuth()
    const result = await requireAuth()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe("user-1")
      expect(result.user.email).toBe("jean@example.com")
      expect(result.user.name).toBe("Jean Dupont")
      expect(result.user.role).toBe("EMPLOYEE")
    }
  })
})
