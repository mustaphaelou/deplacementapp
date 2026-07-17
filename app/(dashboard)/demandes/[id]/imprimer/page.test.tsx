import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise, Role, StatutDemande, TypeTransport } from "@prisma/client"
import { DemandeNotFoundError } from "@/lib/demande-service"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/demande-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demande-service")>()
  return {
    ...actual,
    demandeService: {
      queries: {
        findById: vi.fn(),
      },
    },
  }
})

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

const mockDemande: DemandeDeplacement & { employe: Utilisateur; vehicule: VehiculeEntreprise | null; assigneA: Utilisateur | null } = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: null,
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
    const { demandeService } = await import("@/lib/demande-service")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession())
    ;(demandeService.queries.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })

    expect(demandeService.queries.findById).toHaveBeenCalledWith("d-1")
    expect(element.props.children[0].props.children[1].props.children).toBe("Formulaire de Demande de Déplacement")
  })

  it("redirects when the demande is soft-deleted or missing", async () => {
    const { auth } = await import("@/lib/auth")
    const { demandeService } = await import("@/lib/demande-service")
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
