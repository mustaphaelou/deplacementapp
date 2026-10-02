import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { DemandeDetail } from "@/lib/demande-types"
import {
  STORED_MOTIF_JSON,
  MOTIF_CANONICAL_LABEL,
  MOTIF_CANONICAL_SLUG,
  MOTIF_FREE_TEXT,
  MOTIF_LABELS_EXPECTED_TEXT,
} from "@/lib/test/demande-motif-fixtures"

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
  // Production-shaped: a canonical slug plus an « Autre » free-text entry,
  // exactly as lib/demande/mutations.ts writes them. Seeding a stored literal
  // instead would read identically labelled or unlabelled, and hide the defect.
  motif: STORED_MOTIF_JSON,
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

/** The value the « Motif(s) » property renders, not the whole page. */
function motifCell(html: string): string {
  const labelIndex = html.indexOf(">Motif(s)</p>")
  const start = html.indexOf(">", html.indexOf("</p>", labelIndex) + 4) + 1
  const end = html.indexOf("</p>", start)
  return html.slice(start, end)
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
    // Owned by components/page-header.tsx (the h1's md: breakpoint), pinned in
    // full at components/page-header.test.tsx.
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Demande DD-2025-0001")
    // The header module's OWN icon tile, not this page's stepper pills below —
    // those carry their own bg-primary/10 text-primary runs.
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

  // #299 (review finding 1): the owner case above cannot catch a predicate
  // that is wrong in the permissive direction, because it also satisfies
  // `demande.employeId === userId`. This holds EVERY other field constant —
  // same role, same etape, same decision — and varies only the predicate's
  // input, so the ownership comparison is the only thing that can decide it.
  // Without this, `demande.employeId === userId || demande.etape === "DRAFT"`
  // ships green and shows « Retirer la demande » to a non-owner.
  it("hides withdraw from a non-owner on a DRAFT", async () => {
    const html = await renderPage({
      role: "EMPLOYEE",
      etape: "DRAFT",
      employeId: "u-9",
    })

    expect(html).not.toContain("Retirer la demande")
  })

  // The mirror of the case above, so the pin cannot be satisfied by a
  // predicate that denies everyone: the owner at the SAME etape still sees it.
  it("hides withdraw from a non-owner at a DRAFT while the owner still sees it", async () => {
    const owner = await renderPage({
      role: "EMPLOYEE",
      etape: "DRAFT",
      employeId: "u-1",
    })
    const other = await renderPage({
      role: "EMPLOYEE",
      etape: "DRAFT",
      employeId: "u-9",
    })

    expect(owner).toContain("Retirer la demande")
    expect(other).not.toContain("Retirer la demande")
  })

  // #299: the page no longer decides ownership and hands the verdict to
  // getAllowedActions as `isOwner`. The distinction is invisible in the
  // owner's markup — both draw the button — so the page's own source is what
  // pins it: the fact crosses the boundary, and the verdict crosses back.
  it("passes the ownership fact in and reads the verdicts back", async () => {
    const { readFile } = await import("node:fs/promises")
    const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8")

    expect(source).toMatch(/getAllowedActions\(\s*userRole,\s*isOwner,/)
    // The reader used to receive the userId and the employeId and compare them
    // itself, which put the ownership decision on this page rather than in the
    // pipeline. The comparison stays where the guard can see it.
    expect(source).not.toMatch(/getAllowedActions\([^)]*userId/)
  })
})

// #274: the detail page displayed the Motif list straight out of the storage
// decoder (parseMotif), so it showed raw slugs to the employee. The projection
// (toDemandeDocumentView) is the one home of the labelled list. The suite
// previously seeded `["Réunion client"]` — a stored literal that reads the same
// either way — so it could not see the defect; the seed is now production-shaped
// (a canonical slug + an « Autre » free-text entry), which makes it observable.
describe("Demande detail page — the Motif list comes from the projection", () => {
  it("renders the French label of a stored slug, not the slug", async () => {
    const html = await renderPage()

    expect(motifCell(html)).toContain(MOTIF_CANONICAL_LABEL)
    expect(motifCell(html)).not.toContain(MOTIF_CANONICAL_SLUG)
  })

  it("renders an « Autre » free-text entry verbatim", async () => {
    const html = await renderPage()

    // It is absent from MOTIF_LABELS: the projection's fallback carries it
    // through untouched, and the page must do the same — never blank, never
    // prettified.
    expect(motifCell(html)).toContain(MOTIF_FREE_TEXT)
  })

  it("lists every motif in the stored order, joined", async () => {
    const html = await renderPage()

    expect(motifCell(html)).toBe(MOTIF_LABELS_EXPECTED_TEXT)
  })

  it("shows the raw stored JSON nowhere on the page", async () => {
    const html = await renderPage()

    // A surface that forgot to decode at all would leak the column value; the
    // projection renders labels, so neither the encoded list nor the slug is
    // on screen.
    expect(html).not.toContain(STORED_MOTIF_JSON)
    expect(html).not.toContain(MOTIF_CANONICAL_SLUG)
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Demande detail page — the shared page header", () => {
  it("renders the page's title", async () => {
    const html = await renderPage()

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    // The detail page's own trail: a link crumb back to the list, then this
    // demande's numero in page treatment.
    expect(html).toContain('href="/demandes"')
    expect(html.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(1)
  })
})
