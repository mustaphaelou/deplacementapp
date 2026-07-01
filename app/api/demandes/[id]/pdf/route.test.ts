import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise, Role, StatutDemande, TypeTransport } from "@prisma/client"
import { TravelRequestPdfAdapter } from "@/components/pdf/travel-request-pdf-adapter"
import { DemandeNotFoundError } from "@/lib/demande-service"
import { PdfRenderError } from "@/lib/errors"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demande-service")>()
  return {
    ...actual,
    demandeService: {
      queries: {
        findById: vi.fn(),
      },
      recordDocument: vi.fn().mockResolvedValue(undefined),
    },
  }
})

vi.mock("@/components/pdf/travel-request-pdf-adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/pdf/travel-request-pdf-adapter")>()
  return {
    ...actual,
    pdfAdapter: {
      render: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4")),
    },
  }
})

const mockDemande: DemandeDeplacement & { employe: Utilisateur; vehicule: VehiculeEntreprise | null; assigneA: Utilisateur | null } = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: "u-2",
  statut: "APPROUVEE_MANAGER" as StatutDemande,
  employeNom: "Dupont",
  employePrenom: "Jean",
  employePoste: "Développeur",
  employeDepartement: "IT",
  motif: '["Réunion client"]',
  dateDepart: new Date("2025-06-01"),
  dateRetour: new Date("2025-06-05"),
  destination: "Casablanca",
  typeTransport: "AVION" as TypeTransport,
  autreTransport: null,
  vehiculeId: "v-1",
  fraisTransport: { toNumber: () => 100 } as unknown as DemandeDeplacement["fraisTransport"],
  fraisHebergement: { toNumber: () => 200 } as unknown as DemandeDeplacement["fraisHebergement"],
  fraisRepas: { toNumber: () => 50 } as unknown as DemandeDeplacement["fraisRepas"],
  fraisDivers: { toNumber: () => 30 } as unknown as DemandeDeplacement["fraisDivers"],
  totalEstime: { toNumber: () => 380 } as unknown as DemandeDeplacement["totalEstime"],
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
    motDePasse: "hashed",
    nom: "Dupont",
    prenom: "Jean",
    poste: "Développeur",
    role: "EMPLOYEE" as Role,
    departementId: "dep-1",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2020-01-01"),
    modifieLe: new Date("2020-01-01"),
  },
  vehicule: {
    id: "v-1",
    nom: "Peugeot 3008",
    immatriculation: "AB-123-CD",
    disponible: true,
    creeLe: new Date("2023-01-01"),
  },
  assigneA: {
    id: "u-2",
    email: "pierre.bernard@example.com",
    motDePasse: "hashed",
    nom: "Bernard",
    prenom: "Pierre",
    poste: "Manager",
    role: "MANAGER" as Role,
    departementId: "dep-2",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2020-06-01"),
    modifieLe: new Date("2020-06-01"),
  },
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
  return new NextRequest(`http://localhost/api/demandes/${id}/pdf`)
}

describe("PDF route integration", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("toPdfRenderData produces valid PdfRenderData for TravelRequestPdfAdapter", async () => {
    const { toPdfRenderData } = await import("@/lib/pdf-mapper")
    const data = toPdfRenderData(mockDemande)

    expect(data.numero).toBe("DD-2025-0001")
    expect(data.statut).toBe("APPROUVEE_MANAGER")
    expect(data.assigneA).toEqual({ id: "u-2", nom: "Bernard", prenom: "Pierre" })
    expect(data.vehicule).toEqual({ nom: "Peugeot 3008", immatriculation: "AB-123-CD" })
  })

  it("TravelRequestPdfAdapter renders a non-empty buffer from mapped data", async () => {
    const { toPdfRenderData } = await import("@/lib/pdf-mapper")

    const data = toPdfRenderData(mockDemande)
    const adapter = new TravelRequestPdfAdapter()
    const buffer = await adapter.render(data)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it("GET returns a PDF buffer when demande is found", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { demandeService } = await import("@/lib/demande-service")
    const { pdfAdapter } = await import("@/components/pdf/travel-request-pdf-adapter")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), { params: Promise.resolve({ id: "d-1" }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(demandeService.queries.findById).toHaveBeenCalledWith("d-1")
    expect(demandeService.recordDocument).toHaveBeenCalledWith("d-1", {
      type: "PDF",
      chemin: "demande-DD-2025-0001.pdf",
    })
    expect(pdfAdapter.render).toHaveBeenCalledOnce()
  })

  it("GET returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 }),
    })

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), { params: Promise.resolve({ id: "d-1" }) })

    expect(response.status).toBe(401)
  })

  it("GET returns 404 when demande is soft-deleted or missing", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { demandeService } = await import("@/lib/demande-service")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockRejectedValue(new DemandeNotFoundError())

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), { params: Promise.resolve({ id: "d-1" }) })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Demande introuvable")
  })

  it("GET returns 500 when PDF render fails and does not create a document", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { demandeService } = await import("@/lib/demande-service")
    const { pdfAdapter } = await import("@/components/pdf/travel-request-pdf-adapter")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(pdfAdapter.render as ReturnType<typeof vi.fn>).mockRejectedValue(new PdfRenderError())

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), { params: Promise.resolve({ id: "d-1" }) })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur de génération PDF")
    expect(demandeService.recordDocument).not.toHaveBeenCalled()
  })
})
