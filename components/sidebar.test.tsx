import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { NotificationProvider } from "@/components/notification-context"
import { Sidebar } from "@/components/sidebar"
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

const ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/",
    icon: "bar-chart-3",
    description: "",
  },
  { label: "Mes Demandes", href: "/demandes", icon: "file-text", description: "" },
  {
    label: "Nouvelle Demande",
    href: "/demandes/nouvelle",
    icon: "file-plus",
    description: "",
  },
  {
    label: "Rapports",
    href: "/administration/rapports",
    icon: "bar-chart-3",
    description: "",
  },
]

function renderSidebar(props?: Partial<React.ComponentProps<typeof Sidebar>>) {
  return renderToStaticMarkup(
    <NotificationProvider>
      <Sidebar
        items={ITEMS}
        societeNom="HAY 2010 SARL"
        societeLogoUrl={null}
        {...props}
      />
    </NotificationProvider>
  )
}

describe("Sidebar", () => {
  it("renders the workspace row with the societe name and a collapse button", () => {
    const html = renderSidebar()

    expect(html).toContain("HAY 2010 SARL")
    expect(html).toContain('aria-label="Réduire la barre latérale"')
  })

  it("renders nav items grouped under Espace and Administration headings", () => {
    const html = renderSidebar()

    expect(html).toContain("Espace")
    expect(html).toContain("Administration")
    expect(html).toContain("Tableau de bord")
    expect(html).toContain("Mes Demandes")
    expect(html).toContain("Nouvelle Demande")
    expect(html).toContain("Rapports")
  })

  it("marks the nav row matching the current pathname as active", () => {
    const html = renderSidebar()

    expect(
      /<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>Mes Demandes<\/span>/.test(
        html
      )
    ).toBe(true)
    expect(
      /<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>Tableau de bord<\/span>/.test(
        html
      )
    ).toBe(false)
  })

  it("renders the user row with name, role, profile link and notification bell", () => {
    const html = renderSidebar()

    expect(html).toContain("Yasmine Benali")
    expect(html).toContain("Employé")
    expect(html).toMatch(/<a[^>]*href="\/profil"[^>]*>[\s\S]*Yasmine Benali/)
    expect(html).toMatch(/<a[^>]*href="\/notifications"/)
  })

  it("offers a user menu trigger for profile and logout actions", () => {
    const html = renderSidebar()

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain("Plus d&#x27;options")
  })

  it("shows a close button instead of the collapse button when closeNav is given", () => {
    const html = renderSidebar({ closeNav: () => {} })

    expect(html).toContain('aria-label="Fermer le menu"')
    expect(html).not.toContain('aria-label="Réduire la barre latérale"')
  })
})
