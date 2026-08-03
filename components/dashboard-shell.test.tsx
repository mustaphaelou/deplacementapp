import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardShell } from "@/components/dashboard-shell"
import type { NavItem } from "@/lib/auth"

vi.mock("@/lib/auth/client", () => ({
  useAuthUser: () => ({
    user: {
      id: "u-1",
      name: "Yasmine Benali",
      email: "yasmine@example.ma",
      role: "EMPLOYEE",
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
      avatarUrl: null,
    },
  }),
  signOut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/demandes",
}))

const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/",
    icon: "bar-chart-3",
    description: "",
  },
  { label: "Mes Demandes", href: "/demandes", icon: "file-text", description: "" },
]

describe("DashboardShell", () => {
  it("renders the desktop sidebar, the mobile hamburger and the page content", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        navItems={NAV_ITEMS}
        societeNom="HAY 2010 SARL"
        societeLogoUrl={null}
      >
        <p>Contenu de la page</p>
      </DashboardShell>
    )

    expect(html).toContain("HAY 2010 SARL")
    expect(html).toContain("Tableau de bord")
    expect(html).toContain("Contenu de la page")
    expect(html).toContain('aria-label="Menu"')
    expect(html).toContain('aria-label="Réduire la barre latérale"')
  })

  it("keeps the mobile drawer closed until the hamburger is opened", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        navItems={NAV_ITEMS}
        societeNom="HAY 2010 SARL"
        societeLogoUrl={null}
      >
        <p>Contenu</p>
      </DashboardShell>
    )

    expect(html).not.toContain('aria-label="Fermer le menu"')
  })
})
