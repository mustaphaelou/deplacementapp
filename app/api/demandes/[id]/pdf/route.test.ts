import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DemandeWithRelations } from "@/lib/demande-types"
import { DemandeNotFoundError, PdfRenderError } from "@/lib/errors"

vi.mock("@/lib/auth/server", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  findById: vi.fn(),
  generateDemandeDocumentPdf: vi.fn(),
}))

vi.mock("@/lib/societe", () => ({
  getSocieteBranding: vi.fn(),
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

const mockBranding = {
  id: "s-1",
  nom: "Acme SARL",
  logoUrl: null,
  faviconUrl: null,
  couleurPrimaire: "#0055aa",
  nomExpediteurEmail: "Acme",
  domaineEmail: "acme.ma",
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

  it("GET returns a PDF buffer and delegates to the document module", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById, generateDemandeDocumentPdf } =
      await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")
    const { pdfAdapter } =
      await import("@/components/pdf/travel-request-pdf-adapter")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBranding
    )
    ;(generateDemandeDocumentPdf as ReturnType<typeof vi.fn>).mockResolvedValue(
      Buffer.from("%PDF-1.4")
    )

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(findById).toHaveBeenCalledWith("d-1", {
      id: "u-1",
      role: "EMPLOYEE",
    })
    expect(generateDemandeDocumentPdf).toHaveBeenCalledWith({
      demande: mockDemande,
      branding: mockBranding,
      renderer: pdfAdapter,
    })
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

  it("GET returns 500 when PDF generation fails", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    const { findById, generateDemandeDocumentPdf } =
      await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBranding
    )
    ;(generateDemandeDocumentPdf as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PdfRenderError()
    )

    const { GET } = await import("./route")
    const response = await GET(mockRequest("d-1"), {
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur de génération PDF")
  })
})
