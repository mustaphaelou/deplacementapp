import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { DemandeDetail } from "@/lib/demande-types"

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  findById: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockDemande: DemandeDetail = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-2",
  etape: "FINANCE_REVIEW",
  decision: "PENDING",
  employePrenom: "Jean",
  employeNom: "Dupont",
  employePoste: "Développeur",
  employeDepartement: "IT",
  motif: '["Réunion client"]',
  dateDepart: "2025-06-01",
  dateRetour: "2025-06-05",
  destination: "Casablanca",
  typeTransport: "AVION",
  autreTransport: null,
  vehicule: null,
  fraisTransport: 100,
  fraisHebergement: 200,
  fraisRepas: 50,
  fraisDivers: 30,
  totalEstime: 380,
  avanceRequise: false,
  montantAvance: null,
  description: "Mission de coordination.",
  commentaireManager: "OK pour moi.",
  commentaireFinance: null,
  commentaireDirection: null,
  soumiseLe: "2025-05-24T10:00:00",
  approuveeManagerLe: "2025-05-25T09:00:00",
  approuveeFinanceLe: null,
  approuveeDirectionLe: null,
  rejeteeLe: null,
  retireeLe: null,
  employe: {
    id: "u-1",
    prenom: "Jean",
    nom: "Dupont",
    email: "jean.dupont@example.com",
    poste: "Développeur",
  },
  assigneA: null,
  documents: [],
  creeLe: "2025-05-24T08:00:00",
  modifieLe: "2025-05-24T08:00:00",
}

function mockUser(role = "MANAGER") {
  return {
    id: "u-1",
    email: "user@example.com",
    name: "User",
    role,
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

async function renderPage(
  overrides: { role?: string; etape?: string; employeId?: string } = {}
) {
  const demande = { ...mockDemande, ...overrides } as DemandeDetail
  const { getAuthUser } = await import("@/lib/auth/server")
  const { findById } = await import("@/lib/demande")
  ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockUser(overrides.role ?? "MANAGER")
  )
  ;(findById as ReturnType<typeof vi.fn>).mockResolvedValue(demande)

  const { default: DemandeDetailPage } = await import("./page")
  const element = await DemandeDetailPage({
    params: Promise.resolve({ id: "d-1" }),
  })
  return renderToStaticMarkup(element)
}

describe("Demande detail page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders the 720px document column", async () => {
    const html = await renderPage()
    expect(html).toContain("max-w-[720px]")
  })

  it("renders the prototype header anatomy: breadcrumb, 40px title, icon tile", async () => {
    const html = await renderPage()

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Demande DD-2025-0001")
    expect(html).toContain("bg-primary/10")
    expect(html).toContain("Créée le")
  })

  it("puts PDF and Imprimer in the header actions as ghost buttons with tooltips", async () => {
    const html = await renderPage()

    expect(html).toContain('data-slot="tooltip-trigger"')
    expect(html).toContain("Télécharger le PDF")
    expect(html).toContain("Imprimer")
    expect(html).toContain(`/demandes/d-1/imprimer`)
    expect(html).toContain('aria-label="Télécharger le PDF"')
    expect(html).toContain('aria-label="Imprimer"')
  })

  it("orders the sections: Statut, employé, déplacement, frais, description, commentaires, actions, chronologie", async () => {
    const html = await renderPage({ role: "FINANCE_ADMIN" })

    const order = [
      "Statut",
      "Informations employé",
      "Détails du déplacement",
      "Frais estimés",
      "Description",
      "Commentaires",
      "Actions",
      "Chronologie",
    ]
    const positions = order.map((s) => html.indexOf(s))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], order[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it("uses uppercase hairline-ruled section headings and 2-col property grids", async () => {
    const html = await renderPage()

    expect(html).toContain("uppercase tracking-[0.06em]")
    expect(html).toContain("bg-border")
    expect(html).toContain("grid gap-x-4 gap-y-5 sm:grid-cols-2")
    expect(html).toContain("text-xs text-muted-foreground")
    expect(html).toContain("mt-0.5 text-sm font-medium")
    expect(html).not.toContain('data-slot="card"')
  })

  it("keeps the flat statut stepper: muted pills, brand completed/current, chevrons", async () => {
    const html = await renderPage()

    expect(html).toContain("En attente (Manager)")
    expect(html).toContain("En attente (Finance)")
    expect(html).toContain("bg-primary text-primary-foreground")
    expect(html).toContain("bg-primary/10 text-primary")
    expect(html).toContain("bg-muted text-muted-foreground")
  })

  it("keeps approve / reject actions inline for the role on the queue etape", async () => {
    const html = await renderPage({
      role: "FINANCE_ADMIN",
      etape: "FINANCE_REVIEW",
    })

    expect(html).toContain("Approuver")
    expect(html).toContain("Rejeter")
  })

  it("keeps withdraw for the owner on a DRAFT", async () => {
    const html = await renderPage({
      role: "EMPLOYEE",
      etape: "DRAFT",
      employeId: "u-1",
    })

    expect(html).toContain("Retirer la demande")
  })
})
