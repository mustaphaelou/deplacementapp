import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DemandeExportRow } from "@/lib/demande-queries"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demande-service")>()
  return {
    ...actual,
    demandeService: {
      queries: {
        findAllForExport: vi.fn(),
      },
    },
  }
})

const mockExportRows: DemandeExportRow[] = [
  {
    numero: "DD-2025-0001",
    destination: "Casablanca",
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    typeTransport: "AVION",
    totalEstime: 380,
    statut: "APPROUVEE",
    creeLe: new Date("2025-05-24T10:00:00.000Z"),
    employe: { prenom: "Jean", nom: "Dupont" },
  },
  {
    numero: "DD-2025-0002",
    destination: "Rabat",
    dateDepart: new Date("2025-07-10"),
    dateRetour: new Date("2025-07-12"),
    typeTransport: "BUS",
    totalEstime: null,
    statut: "SOUMISE",
    creeLe: new Date("2025-06-15T08:30:00.000Z"),
    employe: null,
  },
]

function mockAuth(role = "FINANCE_ADMIN") {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "user@example.com",
      name: "User",
      role,
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

describe("CSV export route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET exports demandes through the queries port and returns CSV", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { demandeService } = await import("@/lib/demande-service")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(demandeService.queries.findAllForExport as ReturnType<typeof vi.fn>).mockResolvedValue(mockExportRows)

    const { GET } = await import("./route")
    const response = await GET()

    expect(demandeService.queries.findAllForExport).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")

    const csv = await response.text()
    expect(csv).toContain("Numero,Employe,Destination,DateDepart,DateRetour,Transport,Total,Statut,CreeLe")
    expect(csv).toContain('"DD-2025-0001","Jean Dupont","Casablanca","2025-06-01","2025-06-05","AVION","380","APPROUVEE"')
    expect(csv).toContain('"DD-2025-0002","","Rabat","2025-07-10","2025-07-12","BUS","0","SOUMISE"')
  })

  it("GET returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 }),
    })

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(401)
  })

  it("GET returns 403 when role is not authorised", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth("EMPLOYEE"))

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
  })

  it("GET returns 500 when the queries port throws", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { demandeService } = await import("@/lib/demande-service")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(demandeService.queries.findAllForExport as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB down"))

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
  })
})
