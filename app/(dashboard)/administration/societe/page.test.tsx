import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SectionHeading } from "@/components/display"

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
    // Owned by components/page-header.tsx (the h1's md: breakpoint), pinned in
    // full at components/page-header.test.tsx. Kept here as this page's cheap
    // "the header is here" marker; the class itself is not re-pinned.
    expect(html).toContain("text-[40px]")
    // The page's OWN 720px document column — no module owns this one.
    expect(html).toContain("max-w-[720px]")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flowing settings form: section headings with hairline rules, no cards", async () => {
    const { SocieteSettings } = await import("./page")
    const html = renderToStaticMarkup(<SocieteSettings {...EMPTY_PROPS} />)

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("Identité visuelle")
    // #307: the heading's classes belong to the shared module, so they are
    // asserted as the module's own RENDERED markup next to this page's — not
    // re-pinned here as three separate literal substrings. A page test that
    // spells them is a second copy of the pin the module already owns, and it
    // would have caught this page reverting to a private heading.
    expect(html).toContain(renderToStaticMarkup(<SectionHeading>Identité visuelle</SectionHeading>))
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

// #307: the page used to carry its own SectionHeading and Field, both real
// duplicates of the shared module's. This asserts it renders THROUGH the module
// rather than spelling its own — and it fails if the private copy comes back,
// which a rendered-markup comparison could not: the two produce the same bytes.
describe("Société administration page — the shared display module", () => {
  it("renders both section headings through the shared SectionHeading", async () => {
    const { SocieteSettings } = await import("./page")
    const html = renderToStaticMarkup(<SocieteSettings {...EMPTY_PROPS} />)

    // The page's OWN two titles, each rendered by the module's component.
    for (const title of ["Identité visuelle", "Email"]) {
      expect(
        html,
        `the ${title} section is not the shared SectionHeading's markup`,
      ).toContain(renderToStaticMarkup(<SectionHeading>{title}</SectionHeading>))
    }
  })

  it("declares no private SectionHeading, Field or heading class of its own", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
      "utf8"
    )
    // Rendered markup alone cannot catch this: a private copy that renders the
    // same bytes is invisible to a markup comparison. The source is the only
    // place the duplication is observable.
    expect(
      /function\s+SectionHeading\b/.test(src),
      "the page declares its own SectionHeading — the shared module owns that name",
    ).toBe(false)
    expect(
      /function\s+Field\b/.test(src),
      "the page declares its own Field — the shared module owns that name",
    ).toBe(false)
    for (const token of ["uppercase", "h-px flex-1 bg-border", "tracking-[0.06em]"]) {
      expect(
        src.includes(token),
        `the page still spells ${JSON.stringify(token)} inline; it now reaches ` +
          `the DOM through <SectionHeading />`,
      ).toBe(false)
    }
  })
})

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Société administration page — the shared page header", () => {
  it("renders the page's title", async () => {
    const { default: SocietePage } = await import("./page")
    const html = renderToStaticMarkup(<SocietePage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. The breadcrumb
    // truncation contract (nowrap list, shrinkable last item, truncate on the
    // page element) is the module's marker — a copy would have to reproduce
    // all three to pass.
    expect(html).toContain(">Administration</span>")
    expect(html.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(1)
  })
})
