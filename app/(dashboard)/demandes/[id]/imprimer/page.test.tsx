import { describe, it, expect, vi, beforeEach } from "vitest"
import { DemandeNotFoundError } from "@/lib/errors"
import type { DemandeWithRelations } from "@/lib/demande-types"

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
