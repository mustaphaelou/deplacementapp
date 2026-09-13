import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DashboardDemandeSummary } from "@/lib/dashboard"

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  findMany: vi.fn(),
}))

const SUMMARY: DashboardDemandeSummary = {
  id: "d-1",
  numero: "DD-2026-0001",
  destination: "Casablanca",
  dateDepart: new Date("2026-08-10"),
  dateRetour: new Date("2026-08-12"),
  totalEstime: 1200,
  etape: "MANAGER_REVIEW",
  decision: "PENDING",
  employe: { prenom: "Yasmine", nom: "Benali" },
}

const SERVICE_RESULT = { demandes: [SUMMARY], total: 1 }

function mockAuth() {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "user@example.com",
      name: "User",
      role: "MANAGER",
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

function mockRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/demandes${query}`)
}

describe("GET /api/demandes", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("threads the additive decision filter through to findMany", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findMany } = await import("@/lib/demande")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SERVICE_RESULT)

    const { GET } = await import("./route")
    const response = await GET(mockRequest("?decision=PENDING"))

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(
      { id: "u-1", role: "MANAGER" },
      { page: 1, limit: 10, decision: "PENDING" }
    )
  })

  it("rejects an invalid decision value through the existing 400 path", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findMany } = await import("@/lib/demande")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())

    const { GET } = await import("./route")
    const response = await GET(mockRequest("?decision=UNKNOWN"))

    expect(response.status).toBe(400)
    expect(findMany).not.toHaveBeenCalled()
    const body = await response.json()
    expect(body.error).toBe("Paramètres invalides")
  })

  it("returns the service result unchanged", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findMany } = await import("@/lib/demande")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findMany as ReturnType<typeof vi.fn>).mockResolvedValue(SERVICE_RESULT)

    const { GET } = await import("./route")
    const response = await GET(mockRequest())

    expect(findMany).toHaveBeenCalledWith(
      { id: "u-1", role: "MANAGER" },
      { page: 1, limit: 10 }
    )
    expect(await response.text()).toBe(JSON.stringify(SERVICE_RESULT))
  })
})
