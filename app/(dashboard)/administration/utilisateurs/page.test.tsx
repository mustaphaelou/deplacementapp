import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

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
    expect(html).toContain("text-[40px]")
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
    expect(html).toContain("border-y border-border")
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain(
      "hidden px-2 py-2 font-normal text-muted-foreground md:table-cell"
    )
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
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

  it("keeps the responsive column-collapse classes from the list treatment", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable users={[ACTIVE_USER]} onEdit={() => {}} />
    )

    expect(html).toContain("lg:table-cell")
    expect(html).toContain("md:table-cell")
  })
})

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Utilisateurs administration page — the #258 responsive page header", () => {
  const header = async () => {
    const { default: UtilisateursPage } = await import("./page")
    return renderToStaticMarkup(<UtilisateursPage />)
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
    expect(html).toContain("Nouvel utilisateur")
    expect(html.indexOf("Nouvel utilisateur")).toBeLessThan(
      html.indexOf("Utilisateurs</h1>")
    )
  })
})
