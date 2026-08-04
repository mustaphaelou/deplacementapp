import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { DashboardConfig } from "@/lib/dashboard"

const { mockGetAuthUser } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: mockGetAuthUser,
}))

vi.mock("@/lib/dashboard", () => ({
  getDashboardPayload: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
}))

function mockUser(role = "EMPLOYEE") {
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

const CONFIG: DashboardConfig = {
  subtitle: "Bienvenue sur votre espace personnel",
  statPills: [
    { icon: "file-text", label: "Total", value: 7, color: "blue" },
    { icon: "clock", label: "Brouillons", value: 2, color: "amber" },
  ],
  table: {
    title: "Mes dernières demandes",
    columns: [
      { id: "numero", label: "N°" },
      { id: "destination", label: "Destination" },
      { id: "etape", label: "Statut" },
    ],
    viewAllHref: "/demandes",
    emptyMessage: "Aucune demande pour le moment.",
  },
  cta: {
    label: "Nouvelle demande de déplacement",
    href: "/demandes/nouvelle",
    icon: "plus",
  },
}

const DEMANDE = {
  id: "d-1",
  numero: "D-2026-001",
  destination: "Casablanca",
  dateDepart: new Date("2026-08-10"),
  dateRetour: new Date("2026-08-12"),
  totalEstime: 1200,
  etape: "FINAL",
  decision: "APPROVED",
  employe: { prenom: "Yasmine", nom: "Benali" },
}

describe("Dashboard home page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetAuthUser.mockResolvedValue(mockUser())
  })

  it("renders borderless stat pills (no card chrome) and a flat table", async () => {
    const { getDashboardPayload } = await import("@/lib/dashboard")
    ;(getDashboardPayload as ReturnType<typeof vi.fn>).mockResolvedValue({
      config: CONFIG,
      demandes: [DEMANDE],
    })

    const { default: DashboardPage } = await import("./page")
    const element = await DashboardPage()
    const html = renderToStaticMarkup(element)

    expect(html).not.toContain('data-slot="card"')
    expect(html).not.toContain("shadow-sm")
    expect(html).toContain("bg-primary/10")
    expect(html).toContain("Tableau de bord")
    expect(html).toContain("Mes dernières demandes")
    expect(html).not.toContain('aria-label="Menu"')
  })

  it("keeps Accès rapide tiles with hairline border and ink-tint hover", async () => {
    const { getDashboardPayload } = await import("@/lib/dashboard")
    ;(getDashboardPayload as ReturnType<typeof vi.fn>).mockResolvedValue({
      config: CONFIG,
      demandes: [DEMANDE],
    })

    const { default: DashboardPage } = await import("./page")
    const element = await DashboardPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("border-border")
    expect(html).toContain("hover:bg-accent")
    expect(html).not.toContain("hover:border-primary/40")
    expect(html).not.toContain("shadow-md")
    expect(html).toContain("Accès rapide")
  })

  it("renders 'Voir toutes' as a plain muted link and the quiet empty state", async () => {
    const { getDashboardPayload } = await import("@/lib/dashboard")
    ;(getDashboardPayload as ReturnType<typeof vi.fn>).mockResolvedValue({
      config: CONFIG,
      demandes: [],
    })

    const { default: DashboardPage } = await import("./page")
    const element = await DashboardPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Voir toutes")
    expect(html).not.toContain(">Voir toutes</button>")
    expect(html).not.toContain("border-dashed")
    expect(html).toContain("Aucune demande pour le moment.")
  })

  it("redirects to /login when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const { redirect } = await import("next/navigation")
    const { default: DashboardPage } = await import("./page")
    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT: /login")

    expect(redirect).toHaveBeenCalledWith("/login")
  })
})
