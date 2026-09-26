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
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Nouvelle Demande")
    expect(html).toContain("bg-primary/10")
    expect(html).toContain("Renseignez les informations du déplacement")
  })

  it("uses the 720px document column", async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    const html = renderToStaticMarkup(<NouvelleDemandePage />)

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

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Nouvelle demande page — the #258 responsive page header", () => {
  const header = async () => {
    const { default: NouvelleDemandePage } = await import("./page")
    return renderToStaticMarkup(<NouvelleDemandePage />)
  }

  // The header block only. Negative assertions are scoped to it on purpose:
  // the form body below legitimately uses `flex-wrap` (city chips, the date
  // row), so a whole-page `not.toContain("flex-wrap")` would fail on markup
  // this ticket never touched.
  const headerBlock = (html: string) =>
    html.slice(
      html.indexOf('<div class="mt-6 flex items-center gap-4">'),
      html.indexOf(
        "</p>",
        html.indexOf('<div class="mt-6 flex items-center gap-4">')
      )
    )

  it("scales the title 24px below md: and 40px from md: up", async () => {
    expect(await header()).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const block = headerBlock(await header())

    expect(block).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
    // md: is the single shell breakpoint — no other variant may creep in.
    expect(block).not.toContain("sm:text-[")
    expect(block).not.toContain("lg:text-[")
    expect(block).not.toMatch(/(?:sm|lg):size-\d/)
  })

  it("truncates the breadcrumb to one line instead of wrapping it", async () => {
    const html = await header()
    const crumbs = html.slice(
      html.indexOf('aria-label="breadcrumb"'),
      html.indexOf('<div class="mt-6 flex items-center gap-4">')
    )

    // flex-nowrap on the list — twMerge drops the primitive's flex-wrap, so
    // `flex-nowrap` lands last and `flex-wrap` is gone from the output.
    expect(crumbs).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(crumbs).not.toContain("flex-wrap")
    // min-w-0 on the nav and the last item: a flex item's default min-width:auto
    // refuses to shrink below its content, so without these the ellipsis can
    // never engage.
    expect(crumbs).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(crumbs).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
    // truncate on the page itself, which is what renders the ellipsis.
    expect(crumbs).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("keeps the desktop anatomy byte-identical: mt-6 rhythm, icon, subtitle", async () => {
    const html = await header()
    const block = headerBlock(html)

    // Untouched by #258: the header's own rhythm and the icon treatment.
    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
    expect(block).toContain("Renseignez les informations du déplacement")
    // The breadcrumb row still precedes the title, and the middle crumb link
    // back to the list is intact with its label.
    expect(html.indexOf("Demandes de déplacement")).toBeLessThan(
      html.indexOf("Nouvelle Demande</h1>")
    )
  })
})
