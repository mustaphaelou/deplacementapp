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
