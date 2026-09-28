import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DemandeNotFoundError } from "@/lib/errors"
import type { DemandeWithRelations } from "@/lib/demande-types"
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

vi.mock("@/lib/societe", () => ({
  getSocieteBranding: vi.fn(),
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

  etape: "MANAGER_REVIEW",
  decision: "APPROVED",
  employeNom: "Dupont",
  employePrenom: "Jean",
  employePoste: "Développeur",
  employeDepartement: "IT",
  // Production-shaped: a canonical slug plus an « Autre » free-text entry,
  // exactly as lib/demande/mutations.ts writes them. Seeding a stored literal
  // instead would read identically labelled or unlabelled, and hide the defect.
  motif: STORED_MOTIF_JSON,
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

function mockUser() {
  return {
    id: "u-1",
    email: "user@example.com",
    name: "User",
    role: "EMPLOYEE",
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

function mockBranding(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    nom: "Acme SARL",
    logoUrl: null,
    faviconUrl: null,
    couleurPrimaire: "#0055aa",
    nomExpediteurEmail: "Acme",
    domaineEmail: "acme.ma",
    ...overrides,
  }
}

function findByType(node: unknown, type: string): unknown {
  if (node == null || typeof node !== "object") return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type)
      if (found) return found
    }
    return undefined
  }
  const el = node as {
    type?: unknown
    props?: { children?: unknown; src?: string }
  }
  if (el.type === type) return el
  return findByType(el.props?.children, type)
}

function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(collectText).join(" ")
  if (typeof node === "object" && "props" in node && node.props) {
    return collectText((node as { props: { children: unknown } }).props.children)
  }
  return ""
}

/**
 * Render the page against the mocks and return its static markup. The Motif
 * assertions below read the rendered output rather than the element tree, so
 * they fail the way a reader of the printed form would see them.
 */
async function renderPage(demande: DemandeWithRelations = mockDemande) {
  const { getAuthUser } = await import("@/lib/auth/server")
  const { findById: mockFindById } = await import("@/lib/demande")
  const { getSocieteBranding } = await import("@/lib/societe")

  ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
  ;(mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(demande)
  ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockBranding()
  )

  const { default: ImprimerPage } = await import("./page")
  const element = await ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })
  return renderToStaticMarkup(element)
}

/** The value the « Motif(s) » table cell renders, not the whole page. */
function motifCell(html: string): string {
  const labelIndex = html.indexOf(">Motif(s)</td>")
  const start = html.indexOf(">", labelIndex + ">Motif(s)</td>".length) + 1
  const end = html.indexOf("</td>", start)
  return html.slice(start, end)
}

describe("Imprimer page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders the demande when found", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { findById: mockFindById } = await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBranding()
    )

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({
      params: Promise.resolve({ id: "d-1" }),
    })

    expect(mockFindById).toHaveBeenCalledWith("d-1", {
      id: "u-1",
      role: "EMPLOYEE",
    })
    expect(element.props.children[0].props.children[1].props.children).toBe(
      "Formulaire de Demande de Déplacement"
    )
  })

  it("renders explicit Étape and Décision lines for a terminal Decision", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { findById: mockFindById } = await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockDemande,
      etape: "FINANCE_REVIEW",
      decision: "REJECTED",
    })
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBranding()
    )

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({
      params: Promise.resolve({ id: "d-1" }),
    })

    const text = collectText(element)
    // Where the demande is and what was decided there are two facts on paper.
    expect(text).toMatch(/Étape\s*:\s*En attente \(Finance\)/)
    expect(text).toMatch(/Décision\s*:\s*Rejetée/)
  })

  it("renders the societe nom, logo, and couleurPrimaire accent in the header", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { findById: mockFindById } = await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockBranding({ logoUrl: "/logo-acme.png" })
    )

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({
      params: Promise.resolve({ id: "d-1" }),
    })

    const h1 = findByType(element, "h1") as {
      props?: { children?: string }
    }
    expect(h1?.props?.children).toBe("Acme SARL")

    const img = findByType(element, "img") as {
      props?: { src?: string; alt?: string }
    }
    expect(img?.props?.src).toBe("/logo-acme.png")
    expect(img?.props?.alt).toBe("Acme SARL")

    expect(collectText(element)).toContain("Acme SARL")
    expect(collectText(element)).not.toContain("HAY 2010")

    const header = element.props.children[0]
    expect(header.props.style).toEqual({ borderColor: "#0055aa" })
  })

  it("falls back to Application when branding is null", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { findById: mockFindById } = await import("@/lib/demande")
    const { getSocieteBranding } = await import("@/lib/societe")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDemande)
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: ImprimerPage } = await import("./page")
    const element = await ImprimerPage({
      params: Promise.resolve({ id: "d-1" }),
    })

    const h1 = findByType(element, "h1") as {
      props?: { children?: string }
    }
    expect(h1?.props?.children).toBe("Application")
    expect(findByType(element, "img")).toBeUndefined()
    expect(element.props.children[0].props.style).toBeUndefined()
  })

  it("redirects when the demande is soft-deleted or missing", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { findById: mockFindById } = await import("@/lib/demande")
    const { redirect } = await import("next/navigation")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockFindById as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DemandeNotFoundError()
    )

    const { default: ImprimerPage } = await import("./page")
    await expect(
      ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })
    ).rejects.toThrow("NEXT_REDIRECT: /demandes")

    expect(redirect).toHaveBeenCalledWith("/demandes")
  })

  it("redirects to login when not authenticated", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { redirect } = await import("next/navigation")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: ImprimerPage } = await import("./page")
    await expect(
      ImprimerPage({ params: Promise.resolve({ id: "d-1" }) })
    ).rejects.toThrow("NEXT_REDIRECT: /login")

    expect(redirect).toHaveBeenCalledWith("/login")
  })
})

// #274: the printable form displayed the Motif list straight out of the storage
// decoder (parseMotif), so the paper form printed raw slugs. The projection
// (toDemandeDocumentView) is the one home of the labelled list. The suite
// previously seeded `["Réunion client"]` — a stored literal that reads the same
// either way — so it could not see the defect; the seed is now production-shaped
// (a canonical slug + an « Autre » free-text entry), which makes it observable.
describe("Imprimer page — the Motif list comes from the projection", () => {
  it("prints the French label of a stored slug, not the slug", async () => {
    const html = await renderPage()

    expect(motifCell(html)).toContain(MOTIF_CANONICAL_LABEL)
    expect(motifCell(html)).not.toContain(MOTIF_CANONICAL_SLUG)
  })

  it("prints an « Autre » free-text entry verbatim", async () => {
    const html = await renderPage()

    // It is absent from MOTIF_LABELS: the projection's fallback carries it
    // through untouched, and the form must do the same — never blank, never
    // prettified.
    expect(motifCell(html)).toContain(MOTIF_FREE_TEXT)
  })

  it("prints every motif in the stored order, joined", async () => {
    const html = await renderPage()

    expect(motifCell(html)).toBe(MOTIF_LABELS_EXPECTED_TEXT)
  })

  it("prints the raw stored JSON nowhere on the form", async () => {
    const html = await renderPage()

    // A surface that forgot to decode at all would leak the column value; the
    // projection renders labels, so neither the encoded list nor the slug is
    // on paper.
    expect(html).not.toContain(STORED_MOTIF_JSON)
    expect(html).not.toContain(MOTIF_CANONICAL_SLUG)
  })
})
