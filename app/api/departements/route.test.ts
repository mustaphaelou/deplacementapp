import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/departement/queries", () => ({
  listDepartements: vi.fn(),
}))

function mockAuth() {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "admin@example.com",
      name: "Admin",
      role: "FINANCE_ADMIN",
      departementId: "d-1",
      departement: "Finance",
      poste: "Admin",
    },
  }
}

function unauthorized() {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
    }),
  }
}

describe("departements route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of Departement", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { listDepartements } = await import("@/lib/departement/queries")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(listDepartements as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "d-1", nom: "IT" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([{ id: "d-1", nom: "IT" }])
  })

  it("GET returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { listDepartements } = await import("@/lib/departement/queries")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(
      unauthorized()
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Non autorisé")
    expect(listDepartements as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("GET returns 500 when the queries throw an unknown error", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { listDepartements } = await import("@/lib/departement/queries")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(listDepartements as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur interne")
  })
})
