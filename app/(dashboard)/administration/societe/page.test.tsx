import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const LOGO_SOCIETE = {
  id: "default",
  nom: "HAY 2010 SARL",
  logoUrl: "/uploads/logo.png",
  faviconUrl: null,
  couleurPrimaire: "#0F766E",
  nomExpediteurEmail: "HAY 2010",
  domaineEmail: "hay2010.ma",
}

const EMPTY_PROPS = {
  societe: null,
  nom: "HAY 2010 SARL",
  couleurPrimaire: "#0F766E",
  nomExpediteurEmail: "HAY 2010",
  domaineEmail: "hay2010.ma",
  saving: false,
  onNomChange: () => {},
  onCouleurPrimaireChange: () => {},
  onNomExpediteurEmailChange: () => {},
  onDomaineEmailChange: () => {},
  onSave: () => {},
}

describe("Société administration page", () => {
  it("renders the prototype header anatomy and 720px column from the default render", async () => {
    const { default: SocietePage } = await import("./page")
    const html = renderToStaticMarkup(<SocietePage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("max-w-[720px]")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flowing settings form: section headings with hairline rules, no cards", async () => {
    const { SocieteSettings } = await import("./page")
    const html = renderToStaticMarkup(<SocieteSettings {...EMPTY_PROPS} />)

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("Identité visuelle")
    expect(html).toContain("uppercase")
    expect(html).toContain("tracking-[0.06em]")
    expect(html).toContain("h-px flex-1 bg-border")
    expect(html).toContain("Nom de la société")
    expect(html).toContain("Nom d&#x27;expéditeur email")
    expect(html).toContain("Domaine email")
    expect(html).toContain("Enregistrer")
  })

  it("offers the hex input plus native color picker swatch for the brand color", async () => {
    const { SocieteSettings } = await import("./page")
    const html = renderToStaticMarkup(<SocieteSettings {...EMPTY_PROPS} />)

    expect(html).toContain('type="color"')
    expect(html).toContain('value="#0F766E"')
    expect(html).toContain('aria-label="Choisir une couleur"')
    expect(html).toContain('id="couleurPrimaire"')
  })

  it("shows the logo preview inline in the Identité visuelle section", async () => {
    const { SocieteSettings } = await import("./page")
    const html = renderToStaticMarkup(
      <SocieteSettings {...EMPTY_PROPS} societe={LOGO_SOCIETE} />
    )

    expect(html).toContain("Logo actuel")
    expect(html).toContain('alt="Logo"')
    expect(html).toContain("uploads/logo.png")
  })
})

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Société administration page — the #258 responsive page header", () => {
  const header = async () => {
    const { default: SocietePage } = await import("./page")
    return renderToStaticMarkup(<SocietePage />)
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

  it("keeps the desktop anatomy byte-identical: mt-6 rhythm, icon, subtitle", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
    expect(block).toContain("Personnalisez le nom, la couleur et les emails")
  })
})
