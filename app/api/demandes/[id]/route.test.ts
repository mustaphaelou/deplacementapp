import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DemandeWithRelations } from "@/lib/demande-types"
import { DemandeNotFoundError } from "@/lib/errors"

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  findById: vi.fn(),
}))

const mockDemande: DemandeWithRelations = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: null,

  etape: "MANAGER_REVIEW",
  decision: "PENDING",
  employeNom: "Dupont",
  employePrenom: "Jean",
  employePoste: "Développeur",
  employeDepartement: "IT",
  motif: '["Réunion client"]',
  dateDepart: new Date("2025-06-01"),
  dateRetour: new Date("2025-06-05"),
  destination: "Casablanca",
  typeTransport: "AVION",
  autreTransport: null,
  vehiculeId: null,
  fraisTransport: 100,
  fraisHebergement: 200,
  fraisRepas: 50,
  fraisDivers: 30,
  totalEstime: 380,
  avanceRequise: false,
  montantAvance: null,
  description: null,
  commentaireManager: null,
  commentaireFinance: null,
  commentaireDirection: null,
  soumiseLe: null,
  approuveeManagerLe: null,
  approuveeFinanceLe: null,
  approuveeDirectionLe: null,
  rejeteeLe: null,
  retireeLe: null,
  deletedAt: null,
  creeLe: new Date("2025-05-24"),
  modifieLe: new Date("2025-05-24"),
  employe: {
    id: "u-1",
    email: "jean.dupont@example.com",
    poste: "Développeur",
    prenom: "Jean",
    nom: "Dupont",
  },
  vehicule: null,
  assigneA: null,
}

function mockAuth() {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "user@example.com",
      name: "User",
      role: "EMPLOYEE",
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

function mockRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/demandes/${id}`)
}

describe("GET /api/demandes/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns the demande scoped to the acting utilisateur", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById } = await import("@/lib/demande")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(200)
    expect(findById).toHaveBeenCalledWith("d-1", {
      id: "u-1",
      role: "EMPLOYEE",
    })
    const body = await response.json()
    expect(body.demande.id).toBe("d-1")
  })

  it("returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
      }),
    })

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(401)
  })

  it("returns 404 when the demande is outside the actor's visibility", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById } = await import("@/lib/demande")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DemandeNotFoundError()
    )

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Demande introuvable")
  })
})
