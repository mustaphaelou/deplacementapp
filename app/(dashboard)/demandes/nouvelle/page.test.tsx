import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("Nouvelle demande page", { timeout: 30000 }, () => {
  it("renders the prototype header anatomy: breadcrumb, 40px title, icon tile", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Nouvelle Demande")
    // The header module's icon tile, reached here through components/
    // demande-form.tsx — the form's own fields below carry their own classes.
    expect(html).toContain("bg-primary/10")
    expect(html).toContain("Renseignez les informations du déplacement")
  })

  it("uses the 720px document column", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    // The page's OWN 720px document column — no module owns this one.
    expect(html).toContain("max-w-[720px]")
  })

  it("lays out the four hairline-ruled sections with uppercase headings", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).toContain("uppercase tracking-[0.06em]")
    expect(html).toContain("bg-border")
    expect(html).toContain("Motif &amp; contexte")
    expect(html).toContain("Voyage")
    expect(html).toContain("Logistique")
    expect(html).toContain("Budget &amp; avance")
  })

  it("removes the wizard: no stepper, no per-step navigation", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).not.toContain("Précédent")
    expect(html).not.toContain("Suivant")
    expect(html).not.toContain("Étape")
    expect(html).not.toContain("animate-in")
  })

  it("uses h-9 hairline fields and keeps card-grids without shadow", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).toContain("h-9 rounded-[3px]")
    expect(html).toContain("focus-visible:ring-1 focus-visible:ring-(--brand)")
    expect(html).toContain('data-slot="checkbox"')
    expect(html).toContain("appearance-none rounded-full border")
    expect(html).not.toContain("shadow-lg")
    expect(html).not.toContain('data-slot="card"')
  })

  it("keeps the hairline-ruled total estimé row with bold brand value", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).toContain("Total estimé")
    expect(html).toContain("font-bold text-primary")
    expect(html).toContain("border-t border-border")
  })

  it("places Brouillon + Soumettre actions bottom-right", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    expect(html).toContain("Brouillon")
    expect(html).toContain("Soumettre")
    expect(html).toContain("justify-end")
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Nouvelle demande page — the shared page header", () => {
  it("renders the page's title", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    // The form's own three-item trail, link crumb in the middle (#263).
    expect(html).toContain(">Espace</span>")
    expect(html).toContain('href="/demandes"')
    expect(html.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(2)
  })
})
