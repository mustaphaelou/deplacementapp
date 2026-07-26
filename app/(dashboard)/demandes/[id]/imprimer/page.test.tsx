import { describe, it, expect, vi, beforeEach } from "vitest"
import { DemandeNotFoundError } from "@/lib/demande-service"
import type { DemandeWithRelations } from "@/lib/demande-types"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/demande/di", () => ({
  demandeService: {
    queries: {
      findById: vi.fn(),
    },
  },
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const mockDemande: DemandeWithRelations = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: null,
  statut: "APPROUVEE_MANAGER",
  etape: "",
  decision: "",
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
  assigneA: null,
}

function mockSession() {
  return {
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

describe("Imprimer page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders the demande when found", async () => {
    const { auth } = await import("@/lib/auth")
    const { demandeService } = await import("@/lib/demande/di")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })

    expect(demandeService.queries.findById).toHaveBeenCalledWith("d-1")
    expect(element.props.children[0].props.children[1].props.children).toBe("Formulaire de Demande de Déplacement")
  })

  it("redirects when the demande is soft-deleted or missing", async () => {
    const { auth } = await import("@/lib/auth")
    const { demandeService } = await import("@/lib/demande/di")
    const { redirect } = await import("next/navigation")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockRejectedValue(new DemandeNotFoundError())

    const { default: ImprimerPage } = await import("./page")
    await expect(ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })).rejects.toThrow("NEXT_REDIRECT: /demandes")

    expect(redirect).toHaveBeenCalledWith("/demandes")
  })

  it("redirects to login when not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    const { redirect } = await import("next/navigation")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: ImprimerPage } = await import("./page")
    await expect(ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })).rejects.toThrow("NEXT_REDIRECT: /login")

    expect(redirect).toHaveBeenCalledWith("/login")
  })
})
