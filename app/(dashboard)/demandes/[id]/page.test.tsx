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
  overrides: {
    role?: string
    etape?: string
    employeId?: string
    decision?: string
  } = {}
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

function pillFor(html: string, label: string): string {
  const labelIndex = html.indexOf(label)
  const start = html.lastIndexOf("rounded-full", labelIndex)
  const end = html.indexOf("</div>", labelIndex)
  return html.slice(start, end)
}

function badgeFor(html: string, label: string): string {
  const labelIndex = html.indexOf(label)
  const start = html.lastIndexOf(
    '<div class="inline-flex items-center rounded-md',
    labelIndex
  )
  const end = html.indexOf("</div>", labelIndex)
  return html.slice(start, end)
}

function factLine(html: string, label: string): string {
  const labelIndex = html.indexOf(`>${label}</span>`)
  const end = html.indexOf("</div>", labelIndex)
  return html.slice(labelIndex, end)
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

  it("marks earlier stages past and later stages upcoming around the current stage", async () => {
    const html = await renderPage()

    // True pipeline order, from the presentation module.
    const stageOrder = [
      "Brouillon",
      "En attente (Manager)",
      "En attente (Finance)",
      "En attente (Direction)",
      "Finalisé",
    ]
    const positions = stageOrder.map((s) => html.indexOf(s))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], stageOrder[i]).toBeGreaterThan(positions[i - 1])
    }

    // Stages before FINANCE_REVIEW are past: brand tint + check icon.
    for (const label of ["Brouillon", "En attente (Manager)"]) {
      const past = pillFor(html, label)
      expect(past, label).toContain("bg-primary/10 text-primary")
      expect(past, label).toContain("lucide-circle-check-big")
    }

    // The current stage pill is the brand solid.
    const current = pillFor(html, "En attente (Finance)")
    expect(current).toContain("bg-primary text-primary-foreground")

    // Stages after FINANCE_REVIEW are upcoming: muted, no check.
    for (const label of ["En attente (Direction)", "Finalisé"]) {
      const upcoming = pillFor(html, label)
      expect(upcoming, label).toContain("bg-muted text-muted-foreground")
      expect(upcoming, label).not.toContain("lucide-circle-check-big")
    }
  })

  it("renders a rejected demande with the Rejetée decision badge, Étape kept distinct", async () => {
    const html = await renderPage({ decision: "REJECTED" })

    // The badge carries the presentation module's decision label.
    const badge = badgeFor(html, "Rejetée")
    expect(badge).toContain("bg-destructive/10 text-destructive")
    expect(badge).toContain("Rejetée")

    // Etape and Decision stay two distinct facts: the rejection does not move
    // the Etape, which stays where the decision was recorded.
    expect(factLine(html, "Étape")).toContain("En attente (Finance)")
    expect(factLine(html, "Décision")).toContain("Rejetée")
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

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Demande detail page — the #258 responsive page header", () => {
  // The header block only. Negative assertions are scoped to it on purpose:
  // the page body below legitimately uses `flex-wrap` (section content), so a
  // whole-page `not.toContain("flex-wrap")` would fail on markup this ticket
  // never touched.
  const headerBlock = async () => {
    const html = await renderPage()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    return html.slice(start, html.indexOf("</p>", start))
  }

  it("scales the title 24px below md: and 40px from md: up", async () => {
    const html = await renderPage()

    expect(html).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const block = await headerBlock()

    expect(block).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
    // md: is the single shell breakpoint — no other variant may creep in.
    expect(block).not.toContain("sm:text-[")
    expect(block).not.toContain("lg:text-[")
    expect(block).not.toMatch(/(?:sm|lg):size-\d/)
  })

  it("truncates the breadcrumb to one line instead of wrapping it", async () => {
    const html = await renderPage()
    const crumbs = html.slice(
      html.indexOf('aria-label="breadcrumb"'),
      html.indexOf('<div class="mt-6 flex items-center gap-4">')
    )

    // flex-nowrap on the list — twMerge drops the primitive's flex-wrap, so
    // `flex-nowrap` lands last and `flex-wrap` is gone from the output.
    expect(crumbs).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(crumbs).not.toContain("flex-wrap")
    // min-w-0 on the nav and the last item: a flex item's default min-width:auto
    // refuses to shrink below its content, so without these the ellipsis can
    // never engage.
    expect(crumbs).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(crumbs).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
    // truncate on the page itself, which is what renders the ellipsis.
    expect(crumbs).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("keeps the desktop anatomy and the header actions exactly where they were", async () => {
    const html = await renderPage()
    const block = await headerBlock()

    // Untouched by #258: the mt-6 rhythm and the icon treatment.
    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
    // The top-right ghost actions keep their labels, and the breadcrumb row
    // still precedes the title.
    expect(html).toContain("Télécharger le PDF")
    expect(html).toContain("Imprimer")
    expect(html.indexOf("Imprimer")).toBeLessThan(
      html.indexOf("Demande DD-2025-0001</h1>")
    )
  })
})
