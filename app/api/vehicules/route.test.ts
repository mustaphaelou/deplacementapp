import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { VehiculeNotFoundError } from "@/lib/vehicule-service"

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: (user: { role: string }, role: string) => {
    if (user.role === role) return { ok: true }
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
      }),
    }
  },
}))

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
  requireRole: mockRequireRole,
}))

vi.mock("@/lib/vehicule-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vehicule-service")>()
  return {
    ...actual,
    vehiculeService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

function mockRequest(body: unknown, method: string): NextRequest {
  return new NextRequest("http://localhost/api/vehicules", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

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

describe("vehicules route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of VehiculeEntreprise", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-1", nom: "Peugeot 208" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([{ id: "v-1", nom: "Peugeot 208" }])
  })

  it("GET returns 404 when the service throws VehiculeNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("POST returns 404 when the service throws VehiculeNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(vehiculeService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({ nom: "Peugeot 208", immatriculation: "AB-123-CD" }, "POST"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("PUT returns 404 when the service throws VehiculeNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(vehiculeService.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest(
        { id: "v-1", nom: "Peugeot 208", immatriculation: "AB-123-CD" },
        "PUT"
      ),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("DELETE returns 404 when the service throws VehiculeNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(vehiculeService.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { DELETE } = await import("./route")
    const response = await DELETE(mockRequest({ id: "v-1" }, "DELETE"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })
})
