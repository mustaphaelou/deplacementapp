import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DashboardLayout } from "@/components/dashboard-layout"
import { hideClassFor, tableShellClass } from "@/components/display"
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
    // Owned by components/page-header.tsx (the h1's md: breakpoint and the icon
    // tile), pinned in full at components/page-header.test.tsx.
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

    // #307: the shell is the shared module's value now — asserted as the
    // module's own output rather than re-pinned as a literal substring.
    expect(html).toContain(tableShellClass)
    expect(html).toContain("font-normal text-muted-foreground")
    // The row tint is a DIFFERENT decision (the darker action tint at 0.06),
    // so it is not this module's value and stays pinned here by its own token.
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

    // #307: the rule itself is the shared module's, so the assertion asks the
    // module for its value rather than spelling "hidden … :table-cell" here.
    // Both breakpoints are checked: a rule that always answered `sm:` would
    // satisfy a single pin.
    expect(html).toContain(hideClassFor({ hideAt: "sm" }))
    expect(html).toContain(hideClassFor({ hideAt: "lg" }))
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

  it("draws the ring inset, because the panel clips and an outer ring is lost", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    // This is the assertion the class-string pins above could not make. A cell
    // inside an `overflow-hidden` panel is flush against the clip edge, and
    // `ring-2` is an OUTER box-shadow: it paints outside the cell's own box,
    // so on the first cell — the one a keyboard user tabs to first — 1px of
    // the 2px had room and the ring showed on none of the panel's outer edges.
    // Measured in Chromium against this app's compiled CSS, before the fix:
    // 44 ring-coloured pixels, every one of them in the single inter-cell gap,
    // zero on the panel's top or left edge. With `ring-inset`: 786, a full
    // 2px band on all four sides.
    //
    // So the invariant is a RELATIONSHIP, not a class: any cell carrying a
    // focus ring inside a clipping panel must draw it inset. Stated that way
    // it survives the class being renamed.
    expect(html).toContain("overflow-hidden")
    for (const cls of quickAccessClasses(html)) {
      const tokens = cls.split(/\s+/)
      const ring = tokens.find((t) => /^focus-visible:ring-\d+$/.test(t))

      if (!ring) continue
      expect(
        tokens.includes("focus-visible:ring-inset"),
        `a cell inside the clipping panel carries ${ring} with no ` +
          `focus-visible:ring-inset — an outer ring is clipped away on the ` +
          `panel's edges, so the first cell shows no focus indicator at all`
      ).toBe(true)
    }
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

// #320: the class-string assertions this file RETAINS are not header
// leftovers. The `hideClassFor` block below belongs to spec #305's shared
// display module, which owns the hide rule — the header module owns neither.
// #320 removed only the breadcrumb truncation class this file duplicated from
// components/page-header.tsx.
// #307: this module carried its OWN hideClassFor — a byte-identical duplicate of
// the shared one, serving a DIFFERENT table (the config-driven home widget, not
// the three list pages). The rendered markup cannot show the difference: both
// copies return the same string, so a markup assertion passes either way. The
// source is the only place the duplication is observable, and this is the pin
// that fails when a private copy is restored.
describe("DashboardLayout — the responsive-hide rule is not redefined here", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "dashboard-layout.tsx"),
    "utf8"
  )

  it("declares no hideClassFor of its own", () => {
    expect(
      /function\s+hideClassFor\b/.test(src),
      "components/dashboard-layout.tsx declares its own hideClassFor — the " +
        "duplicate #307 deleted. The rule is owned once, by @/components/display.",
    ).toBe(false)
  })

  it("imports the rule from the shared module and still calls it at both sites", () => {
    expect(
      /import\s*\{[^}]*\bhideClassFor\b[^}]*\}\s*from\s*"@\/components\/display"/.test(src),
      "the layout calls hideClassFor without importing it from the shared module",
    ).toBe(true)
    // Two call sites — the header cell and the body cell. The duplicate was
    // silent at one of them, so a count is the pin, not a presence check.
    expect(
      (src.match(/hideClassFor\(/g) ?? []).length,
      "the layout's widget table hides a cell in BOTH its header and its body",
    ).toBe(2)
  })
})

// #261: the header class pins live once now, in
// components/page-header.test.tsx, against the module that owns them. The four
// cases this block used to carry are all there by name: the title scale, the
// tile scale with the single-breakpoint negatives, the three-part truncation
// chain, and the action sitting above the title. What stays here is the cheap
// per-page guarantee: this layout still renders its title through the shared
// header.
describe("DashboardLayout — the shared page header", () => {
  it("renders the page's title", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout config={CONFIG} navItems={NAV_ITEMS} demandes={[]} />
    )

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    // The layout's own trail, plus the CTA it configures — the one call site
    // that already carried gap-4, so the row keeps the module's form.
    expect(html).toContain(">Espace</span>")
    // Owned by components/page-header.tsx (the breadcrumb row), pinned in full
    // at components/page-header.test.tsx.
    expect(html).toContain(
      '<div class="flex items-center justify-between gap-4">'
    )
    expect(html).toContain("Nouvelle demande")
  })
})
