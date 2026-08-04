import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("Nouvelle demande page", () => {
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
    expect(html).toContain("data-slot=\"checkbox\"")
    expect(html).toContain("appearance-none rounded-full border")
    expect(html).not.toContain("shadow-lg")
    expect(html).not.toContain("data-slot=\"card\"")
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
