import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { hideClassFor, rowHoverInkTint, tableShellClass } from "@/components/display"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const AVAILABLE_VEHICULE = {
  id: "v-1",
  nom: "Dacia Logan",
  immatriculation: "12345-A-6",
  disponible: true,
}

const BUSY_VEHICULE = {
  id: "v-2",
  nom: "Peugeot 208",
  immatriculation: "67890-B-1",
  disponible: false,
}

describe("Véhicules administration page", () => {
  it("renders the prototype header anatomy: breadcrumb, icon tile, 40px title, primary action", async () => {
    const { default: VehiculesPage } = await import("./page")
    const html = renderToStaticMarkup(<VehiculesPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("Ajouter un véhicule")
    expect(html).toContain("véhicule(s)")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flat table verbatim: no card, hairline borders, muted header, quiet right-aligned actions", async () => {
    const { VehiculesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <VehiculesTable
        vehicules={[AVAILABLE_VEHICULE, BUSY_VEHICULE]}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    )

    expect(html).not.toContain('data-slot="card"')
    // #307: the shell and the row tint belong to the shared module now, so they
    // are asserted as the module's own output rather than re-pinned as literals.
    expect(html).toContain(tableShellClass)
    // The cell padding and the table's min-width are this page's own
    // shell. components/display.tsx's tableShellClass owns the
    // overflow/border/text-sm run, not these — so they stay here.
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain(rowHoverInkTint)
    expect(html).toContain("min-w-[300px]")
    expect(html).toContain(">Actions</th>")
    expect(html).toContain(
      "opacity-30 transition-opacity group-hover:opacity-100"
    )
    expect(html).toContain('aria-label="Modifier Dacia Logan"')
    expect(html).toContain('aria-label="Supprimer Dacia Logan"')
  })

  // #320: the class-string assertions this file RETAINS are not header
  // leftovers. This one and the `hideClassFor` block below belong to spec
  // #305's shared display module, which owns the hide rule — the header module
  // owns neither. #320 removed only the breadcrumb truncation class this file
  // duplicated from components/page-header.tsx.
  // #307: the Statut column's header and its one body cell now ask the shared
  // rule. Asserted as the module's output reaching the DOM, plus the count and
  // the absence of a hand-written pair — so it fails both if a migrated cell
  // stops hiding and if the page keeps a private copy beside the import.
  it("hides the Statut column through the shared rule", async () => {
    const { VehiculesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <VehiculesTable vehicules={[AVAILABLE_VEHICULE]} onEdit={() => {}} onDelete={() => {}} />
    )

    expect(
      html,
      `no cell carries ${hideClassFor({ hideAt: "sm" })} — the migrated ` +
        `Statut column has stopped hiding on a phone`,
    ).toContain(hideClassFor({ hideAt: "sm" }))

    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
      "utf8"
    )
    expect(
      /className="[^"]*hidden[^"]*(sm|md|lg):table-cell/.test(src),
      "the page still spells a hide pair inline instead of calling hideClassFor",
    ).toBe(false)
    expect(
      (src.match(/hideClassFor\(\{\s*hideAt:/g) ?? []).length,
      "the Véhicules table hides two cells below sm: its header and its body cell",
    ).toBe(2)
  })

  it("keeps the semantic status tones: Disponible success, En mission pending", async () => {
    const { VehiculesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <VehiculesTable
        vehicules={[AVAILABLE_VEHICULE, BUSY_VEHICULE]}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    )

    // The pill tones are components/status-pill.tsx's TONE_CLASSES
    // (neutral/pending/success/danger); this page only chooses one.
    expect(html).toContain("bg-[#E5F3EE]")
    // The pending tone is components/status-pill.tsx's TONE_CLASSES.
    expect(html).toContain("bg-[#FBF0DB]")
    expect(html).toContain("Disponible")
    expect(html).toContain("En mission")
    // The page's own mono treatment for the plate column.
    expect(html).toContain("font-mono")
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Véhicules administration page — the shared page header", () => {
  it("renders the page's title", async () => {
    const { default: VehiculesPage } = await import("./page")
    const html = renderToStaticMarkup(<VehiculesPage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    expect(html).toContain(">Administration</span>")
    expect(html).toContain("véhicule(s)</p>")
  })
})
