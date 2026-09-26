import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardLayout } from "@/components/dashboard-layout"
import type { DashboardConfig, DashboardDemandeSummary } from "@/lib/dashboard"
import type { NavItem } from "@/lib/auth"

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: "bar-chart-3", description: "" },
  {
    label: "Mes Demandes",
    href: "/demandes",
    icon: "file-text",
    description: "Consulter et créer",
  },
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
  cta: { label: "Nouvelle demande", href: "/demandes/nouvelle", icon: "plus" },
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
// pill now reads the presentation module — through StatusPill, the one pill
// the list page already renders — so both screens tell one story.
describe("DashboardLayout — the row pill for a DemandeDeplacement", () => {
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
    // The danger tone is StatusPill's, not the Badge variant's.
    expect(html).toContain("bg-[#FBE9E9]")
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

    expect(html).toContain(">Approuvée</span>")
    expect(html).toContain("bg-[#E5F3EE]")
    expect(html).toContain('dark:text-zinc-300">Retirée</span>')
    expect(html).toContain(">En attente (Finance)</span>")
    expect(html).toContain("bg-[#FBF0DB]")
  })

  it("renders the pill as StatusPill — no second, differently-shaped badge", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "FINAL", decision: "APPROVED" })]}
      />
    )

    expect(html).toContain("rounded-full")
    expect(html).not.toContain('data-slot="badge"')
  })
})

// The home page is the one page that missed the #171 restyle: it had no
// breadcrumb, a 2xl semibold heading instead of the 40px page title its
// siblings use, and shadcn's Table — a heavier surface than every other table
// in the app. These pins hold the geometry to the shared one.
describe("DashboardLayout — the page chrome matches its sibling pages", () => {
  it("carries the shared page header: breadcrumb, action, icon tile, 40px title", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Espace")
    expect(html).toContain("Tableau de bord")
    // The primary action sits top-right, above the title — not beside it.
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Nouvelle demande")
    expect(html).toContain("bg-primary/10")
    // The h1 is no longer the 2xl semibold heading the old home page used
    // (the stat pills keep that scale for their own values).
    expect(html).not.toContain('<h1 class="text-2xl')
  })

  it("renders the table as the database surface the list page uses", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "FINAL", decision: "APPROVED" })]}
      />
    )

    expect(html).toContain("border-y border-border")
    expect(html).toContain("font-normal text-muted-foreground")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
    // shadcn's Table is gone: it brings its own border-b rows and a
    // hover:bg-muted/50 that reads heavier than the rest of the app.
    expect(html).not.toContain('data-slot="table"')
    expect(html).not.toContain("hover:bg-muted/50")
  })

  it("keeps the column's responsive hiding and the row link reachable", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={{
          ...CONFIG,
          table: {
            ...CONFIG.table,
            columns: [
              { id: "numero", label: "N°" },
              { id: "destination", label: "Destination", hideAt: "sm" },
              { id: "total", label: "Total", hideAt: "lg" },
            ],
          },
        }}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "FINAL", decision: "APPROVED" })]}
      />
    )

    expect(html).toContain("hidden sm:table-cell")
    expect(html).toContain("hidden lg:table-cell")
    // Every row is reachable without knowing its numéro: the trailing control
    // carries an accessible name.
    expect(html).toContain('aria-label="Ouvrir la demande D-2026-001"')
    expect(html).toContain('href="/demandes/d-1"')
  })

  it("keeps the stat pills borderless — no card chrome", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    expect(html).toContain("Total")
    expect(html).toContain("tabular-nums")
    expect(html).not.toContain('data-slot="card"')
    expect(html).not.toContain("shadow-sm")
  })

  it("draws Accès rapide as one hairline panel with ink-tint hover", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    expect(html).toContain("Accès rapide")
    expect(html).toContain("border-border")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.06)]")
    // The tile that pointed at itself is gone — only the real destinations.
    expect(html).not.toContain('href="/"')
  })
})

describe("DashboardLayout — the empty queue", () => {
  it("stays quiet and hairlined, keeps the configured copy, offers the action", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    expect(html).toContain("Aucune demande pour le moment.")
    expect(html).toContain("border-y border-border")
    expect(html).not.toContain("border-dashed")
    expect(html).not.toContain("py-10")
  })
})

describe("DashboardLayout — the Accès rapide focus ring (#252)", () => {
  const quickAccessClasses = (html: string): string[] =>
    [...html.matchAll(/class="([^"]*)"/g)]
      .map(([, cls]) => cls)
      .filter((cls) => cls.includes("px-3 py-2.5"))

  it("carries the app-wide focus pattern on every quick-access cell", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    const classes = quickAccessClasses(html)
    expect(classes.length).toBeGreaterThan(0)
    for (const cls of classes) {
      expect(cls).toContain("outline-none")
      expect(cls).toContain("focus-visible:ring-2")
      expect(cls).toContain("focus-visible:ring-ring")
    }
  })

  it("has no bare outline utility left painting a fake ring at rest", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    for (const cls of quickAccessClasses(html)) {
      // `outline-none` contains the substring "outline", so compare tokens,
      // not substrings: the bare `outline`/`outline-border` pair paints at
      // rest under Tailwind v4 and must be gone.
      expect(cls.split(/\s+/)).not.toContain("outline")
      expect(cls.split(/\s+/)).not.toContain("outline-border")
      expect(cls.split(/\s+/)).not.toContain("outline-offset-[-1px]")
    }
  })

  it("keeps the hairline divider on the shadow slot so the ring is not erased", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    // Dividers moved off `outline` and onto --tw-shadow as an inset shadow:
    // Tailwind composes one box-shadow from five slots, so a cell can carry
    // both the resting hairline and the focus ring at once.
    expect(html).toContain("shadow-[inset_0_0_0_1px_var(--color-border)]")
    // The 1px gap and the panel container are the phantom-cell guards.
    expect(html).toContain("gap-px")
    expect(html).toContain(
      "overflow-hidden rounded-[3px] border border-border"
    )
  })
})

// On a phone the chevron was the only way out of a row: #249 turned the numero
// cell into a plain span, and `opacity-0 group-hover:opacity-100` needs a
// hover-capable pointer to ever resolve. The list page already shipped the
// fix — visible by default, hidden only from sm up, where hover exists.
describe("DashboardLayout — the row chevron is reachable without a pointer", () => {
  it("carries the list page's mobile-visible opacity triple", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "FINAL", decision: "APPROVED" })]}
      />
    )

    expect(html).toContain("sm:opacity-0 sm:group-hover:opacity-100")
    // …and the mobile half of it, not just the hover half. Without opacity-100
    // below sm the triple would resolve to nothing at all. Matched without the
    // `class="` anchor: lucide prepends its own `lucide lucide-chevron-right`
    // to the element's class attribute, so it does not begin at size-3.5.
    expect(html).toContain(
      "size-3.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
    )
    expect(html).not.toContain(
      "size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
    )
  })

  it("keeps the chevron's link the row's named, reachable exit", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[
          demande({ id: "d-1", numero: "D-2026-001", etape: "FINAL", decision: "APPROVED" }),
          demande({ id: "d-2", numero: "D-2026-002", etape: "MANAGER_REVIEW", decision: "REJECTED" }),
        ]}
      />
    )

    expect(html).toContain('aria-label="Ouvrir la demande D-2026-001"')
    expect(html).toContain('aria-label="Ouvrir la demande D-2026-002"')
    expect(html).toContain('href="/demandes/d-1"')
    expect(html).toContain('href="/demandes/d-2"')
    // Every row gets one, not just the first.
    expect(html.match(/Ouvrir la demande/g)).toHaveLength(2)
  })

  it("leaves the numero cell a plain span — the whole row is not a link", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout
        config={CONFIG}
        navItems={NAV_ITEMS}
        demandes={[demande({ etape: "FINAL", decision: "APPROVED" })]}
      />
    )

    // Out of scope for this ticket: the chevron is the affordance. If the
    // numero ever becomes an anchor, this pin is the one that should break.
    expect(html).toContain('<span class="font-medium">D-2026-001</span>')
    expect(html).not.toContain('href="/demandes/d-1" class="font-medium"')
  })
})
