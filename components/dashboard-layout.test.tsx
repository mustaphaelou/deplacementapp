import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardLayout } from "@/components/dashboard-layout"
import type { DashboardConfig, DashboardDemandeSummary } from "@/lib/dashboard"
import type { NavItem } from "@/lib/auth"

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: "bar-chart-3", description: "" },
  { label: "Mes Demandes", href: "/demandes", icon: "file-text", description: "" },
]

const CONFIG: DashboardConfig = {
  subtitle: "Bienvenue sur votre espace personnel",
  statPills: [{ icon: "file-text", label: "Total", value: 1, color: "blue" }],
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
}

function demande(args: {
  etape: string
  decision: string
  id?: string
  numero?: string
}): DashboardDemandeSummary {
  return {
    id: args.id ?? "d-1",
    numero: args.numero ?? "D-2026-001",
    destination: "Casablanca",
    dateDepart: new Date("2026-08-10"),
    dateRetour: new Date("2026-08-12"),
    totalEstime: 1200,
    etape: args.etape,
    decision: args.decision,
    employe: { prenom: "Yasmine", nom: "Benali" },
  }
}

// The dashboard used to ignore the Decision: a rejected DemandeDeplacement
// rendered "En attente (Manager)" there while the list said "Rejetée". The row
// badge now reads the presentation module, so both screens tell one story.
describe("DashboardLayout — the row badge for a DemandeDeplacement", () => {
  it("renders a rejected DemandeDeplacement as 'Rejetée (Manager)' — never 'En attente'", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "MANAGER_REVIEW", decision: "REJECTED" })]}
      />
    )

    expect(html).toContain("Rejetée (Manager)")
    expect(html).not.toContain("En attente")
    // The danger tone maps to the destructive Badge variant.
    expect(html).toContain("bg-destructive/10")
  })

  it("renders the module's compact label and tone for the other Decisions", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[
          demande({
            id: "d-2",
            numero: "D-2026-002",
            etape: "FINAL",
            decision: "APPROVED",
          }),
          demande({
            id: "d-3",
            numero: "D-2026-003",
            etape: "MANAGER_REVIEW",
            decision: "WITHDRAWN",
          }),
          demande({
            id: "d-4",
            numero: "D-2026-004",
            etape: "FINANCE_REVIEW",
            decision: "PENDING",
          }),
        ]}
      />
    )

    expect(html).toContain(">Approuvée</div>")
    expect(html).toContain("bg-emerald-100")
    expect(html).toContain('text-foreground">Retirée</div>')
    expect(html).toContain(">En attente (Finance)</div>")
    expect(html).toContain("bg-amber-100")
  })
})
