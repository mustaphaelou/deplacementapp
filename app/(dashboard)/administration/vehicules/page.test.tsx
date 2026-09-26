import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

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
    expect(html).toContain("text-[40px]")
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
    expect(html).toContain("border-y border-border")
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
    expect(html).toContain("min-w-[300px]")
    expect(html).toContain(">Actions</th>")
    expect(html).toContain(
      "opacity-30 transition-opacity group-hover:opacity-100"
    )
    expect(html).toContain('aria-label="Modifier Dacia Logan"')
    expect(html).toContain('aria-label="Supprimer Dacia Logan"')
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

    expect(html).toContain("bg-[#E5F3EE]")
    expect(html).toContain("bg-[#FBF0DB]")
    expect(html).toContain("Disponible")
    expect(html).toContain("En mission")
    expect(html).toContain("font-mono")
  })
})

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Véhicules administration page — the #258 responsive page header", () => {
  const header = async () => {
    const { default: VehiculesPage } = await import("./page")
    return renderToStaticMarkup(<VehiculesPage />)
  }

  it("scales the title 24px below md: and 40px from md: up", async () => {
    expect(await header()).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

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

  it("keeps the desktop anatomy and the primary action exactly where they were", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    // Untouched by #258: the mt-6 rhythm, the icon, and the top-right action
    // with its label.
    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
    expect(html).toContain("Ajouter un véhicule")
    expect(html.indexOf("Ajouter un véhicule")).toBeLessThan(
      html.indexOf("Véhicules</h1>")
    )
  })
})
