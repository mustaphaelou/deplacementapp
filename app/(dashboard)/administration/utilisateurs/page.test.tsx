import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  hideClassFor,
  rowHoverInkTint,
  tableShellClass,
} from "@/components/display"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const ACTIVE_USER = {
  id: "u-1",
  email: "yasmine@example.ma",
  nom: "Benali",
  prenom: "Yasmine",
  poste: "Dev",
  role: "MANAGER",
  actif: true,
  telephone: null,
  googleAuthEnabled: true,
  departement: { id: "d-1", nom: "IT" },
}

const INACTIVE_USER = {
  id: "u-2",
  email: "omar@example.ma",
  nom: "El Amrani",
  prenom: "Omar",
  poste: "Compta",
  role: "EMPLOYEE",
  actif: false,
  telephone: null,
  googleAuthEnabled: false,
  departement: { id: "d-2", nom: "Finance" },
}

describe("Utilisateurs administration page", () => {
  it("renders the prototype header anatomy: breadcrumb, icon tile, 40px title, primary action", async () => {
    const { default: UtilisateursPage } = await import("./page")
    const html = renderToStaticMarkup(<UtilisateursPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("Nouvel utilisateur")
    expect(html).toContain("utilisateur(s)")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flat table verbatim: no card, hairline borders, muted header, quiet right-aligned actions", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable
        users={[ACTIVE_USER, INACTIVE_USER]}
        onEdit={() => {}}
      />
    )

    expect(html).not.toContain('data-slot="card"')
    // #307: the shell and the row tint are this module's values now, so they
    // are asserted as the module's own output rather than as literals spelled
    // here — a page test that re-pins them is a second copy of the pin.
    expect(html).toContain(tableShellClass)
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain(rowHoverInkTint)
    expect(html).toContain("min-w-[500px]")
    expect(html).toContain(">Actions</th>")
    expect(html).toContain(
      "opacity-30 transition-opacity group-hover:opacity-100"
    )
  })

  it("uses neutral StatusPills for roles and Google, semantic tones for status", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable
        users={[ACTIVE_USER, INACTIVE_USER]}
        onEdit={() => {}}
      />
    )

    expect(html).toContain("bg-[#F1F1EF]")
    expect(html).toContain("Google")
    expect(html).toContain("bg-[#E5F3EE]")
    expect(html).toContain("bg-[#FBE9E9]")
    expect(html).toContain("Actif")
    expect(html).toContain("Inactif")
    expect(html).toContain("Responsable")
  })

  // #320: the class-string assertions this file RETAINS are not header
  // leftovers. This one and the `hideClassFor` block below belong to spec
  // #305's shared display module, which owns the hide rule — the header module
  // owns neither. #320 removed only the breadcrumb truncation class this file
  // duplicated from components/page-header.tsx.
  // #307: the eight hidden cells now ask the shared rule for their half of the
  // pair. This asserts the module's own output REACHES this page's DOM, at each
  // breakpoint the table uses, and that the page spells no pair of its own. Both
  // halves matter: the first fails if a migrated cell stops hiding (the class
  // never reaches the element), the second fails if the page keeps a private
  // copy while importing the module.
  it("hides its narrow columns through the shared rule, at each breakpoint the table uses", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable users={[ACTIVE_USER]} onEdit={() => {}} />
    )

    for (const breakpoint of ["md", "lg"] as const) {
      expect(
        html,
        `no cell carries ${hideClassFor({ hideAt: breakpoint })} — a migrated ` +
          `cell has stopped hiding, so it would show on a phone`,
      ).toContain(hideClassFor({ hideAt: breakpoint }))
    }

    // PER CELL, not per breakpoint. A whole-table `toContain("hidden
    // md:table-cell")` is satisfied by any one of the four md cells, so dropping
    // the rule from a single td leaves the table green — the column would show
    // on a phone and the pin would not notice. These read the class attribute
    // off each hiding cell individually, by the text it wraps.
    const cellClass = (html: string, tag: string, text: string): string => {
      const at = html.indexOf(`>${text}</${tag}>`)
      expect(
        at,
        `the ${tag} wrapping ${JSON.stringify(text)} is absent from the markup — ` +
          `the element moved, so the per-cell assertion below would pass vacuously`,
      ).toBeGreaterThan(-1)
      const open = html.lastIndexOf("<", at)
      return html.slice(open, at).match(/class="([^"]*)"/)?.[1] ?? ""
    }
    for (const [tag, text, breakpoint] of [
      ["th", "Email", "md"],
      ["th", "Poste", "md"],
      ["th", "Département", "lg"],
      ["th", "Auth", "lg"],
      ["td", "yasmine@example.ma", "md"],
      ["td", "Dev", "md"],
      ["td", "IT", "lg"],
    ] as const) {
      const cls = cellClass(html, tag, text)
      const wanted = hideClassFor({ hideAt: breakpoint as "md" | "lg" }) ?? ""
      expect(
        cls.split(/\s+/),
        `the ${tag} for ${JSON.stringify(text)} no longer hides below ${breakpoint}: ` +
          `its class attribute carries ${JSON.stringify(cls)}`,
      ).toContain("hidden")
      expect(cls.split(/\s+/)).toContain(`${breakpoint}:table-cell`)
      expect(cls).toContain(wanted)
    }

    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
      "utf8"
    )
    expect(
      /className="[^"]*hidden[^"]*(sm|md|lg):table-cell/.test(src),
      "the page still spells a hide pair inline instead of calling hideClassFor",
    ).toBe(false)
    // Counted, not grepped: eight cells (4 headers + 4 body) each ask the rule.
    expect(
      (src.match(/hideClassFor\(\{\s*hideAt:/g) ?? []).length,
      "the Utilisateurs table hides eight cells below a breakpoint (4 th + 4 td); " +
        "each must reach the shared rule",
    ).toBe(8)
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Utilisateurs administration page — the shared page header", () => {
  it("renders the page's title", async () => {
    const { default: UtilisateursPage } = await import("./page")
    const html = renderToStaticMarkup(<UtilisateursPage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    expect(html).toContain(">Administration</span>")
    // The subtitle is this page's own live count, passed as a node.
    expect(html).toContain("utilisateur(s)</p>")
  })
})
