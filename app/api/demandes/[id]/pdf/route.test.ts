import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DemandeWithRelations } from "@/lib/demande-types"
import { TravelRequestPdfAdapter } from "@/components/pdf/travel-request-pdf-adapter"
import { DemandeNotFoundError, PdfRenderError } from "@/lib/errors"

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  findById: vi.fn(),
  recordDocument: vi.fn().mockResolvedValue(undefined),
}))

vi.mock(
  "@/components/pdf/travel-request-pdf-adapter",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/components/pdf/travel-request-pdf-adapter")
      >()
    return {
      ...actual,
      pdfAdapter: {
        render: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4")),
      },
    }
  }
)

const mockDemande: DemandeWithRelations = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: "u-2",

  etape: "FINANCE_REVIEW",
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
  vehiculeId: "v-1",
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
  vehicule: {
    nom: "Peugeot 3008",
    immatriculation: "AB-123-CD",
  },
  assigneA: {
    id: "u-2",
    nom: "Bernard",
    prenom: "Pierre",
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
    expect(data.etape).toBe("FINANCE_REVIEW")
    expect(data.assigneA).toEqual({
      id: "u-2",
      nom: "Bernard",
      prenom: "Pierre",
    })
    expect(data.vehicule).toEqual({
      nom: "Peugeot 3008",
      immatriculation: "AB-123-CD",
    })
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
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById, recordDocument } = await import("@/lib/demande")
    const { pdfAdapter } =
      await import("@/components/pdf/travel-request-pdf-adapter")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(findById).toHaveBeenCalledWith("d-1")
    expect(recordDocument).toHaveBeenCalledWith("d-1", {
      type: "PDF",
      chemin: "demande-DD-2025-0001.pdf",
    })
    expect(pdfAdapter.render).toHaveBeenCalledOnce()
  })

  it("GET returns 401 when auth fails", async () => {
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

  it("GET returns 404 when demande is soft-deleted or missing", async () => {
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

  it("GET returns 500 when PDF render fails and does not create a document", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById, recordDocument } = await import("@/lib/demande")
    const { pdfAdapter } =
      await import("@/components/pdf/travel-request-pdf-adapter")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(pdfAdapter.render as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PdfRenderError()
    )

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur de génération PDF")
    expect(recordDocument).not.toHaveBeenCalled()
  })
})
