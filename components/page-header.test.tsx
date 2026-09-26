import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { BarChart, FileText } from "lucide-react"
import { PageHeader } from "@/components/page-header"

// #261: the responsive header class set used to be copied into all ten call
// sites, and each of the ten test files re-asserted the same four `it` cases
// against its own page. The guarantees are unchanged; they are asserted once
// here, against the markup that now owns them, grouped so a failure names the
// rule it broke rather than the page it broke on.
//
// The pins assert the FULL class attribute, not a substring: a bare
// `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone and so
// could not catch a half-applied rule. A green test proves a class string is
// present, never how the header looks — the render suite runs in a `node`
// environment with no CSS engine. Visual confirmation is the manual light and
// dark eyeball, not this file.

const header = (props: Partial<Parameters<typeof PageHeader>[0]> = {}) =>
  renderToStaticMarkup(
    <PageHeader
      crumbs={["Espace", "Rapports"]}
      title="Rapports"
      subtitle="Vue d'ensemble des demandes de déplacement"
      icon={BarChart}
      {...props}
    />
  )

// The header block only. The negative assertions below are scoped to it on
// purpose: a page's body below legitimately carries its own breakpoint classes.
const headerBlock = (html: string) =>
  html.slice(
    html.indexOf('<div class="mt-6 flex items-center gap-4">'),
    html.indexOf("</p>", html.indexOf('<div class="mt-6 flex items-center gap-4">'))
  )

const breadcrumbBlock = (html: string) =>
  html.slice(
    html.indexOf('aria-label="breadcrumb"'),
    html.indexOf('<div class="mt-6 flex items-center gap-4">')
  )

describe("PageHeader — the title scale", () => {
  it("scales the title 24px below md: and 40px from md: up", () => {
    expect(header()).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("keeps the title's wrapper shrinkable so the title can truncate", () => {
    expect(header()).toContain('class="min-w-0"')
  })
})

describe("PageHeader — the icon tile", () => {
  it("scales the tile 40px below md: and 48px from md: up", () => {
    expect(headerBlock(header())).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
  })

  it("gives the icon the primary treatment at 24px", () => {
    expect(headerBlock(header())).toContain("size-6 text-primary")
  })

  it("renders no tile when the icon is absent — the exception stays explicit", () => {
    // The shape the interface exists for: an absent icon is an absent tile,
    // never a blank square. #258's profile header is a different block and
    // does not come through here.
    expect(header({ icon: undefined })).not.toContain("rounded-[3px] bg-primary/10")
    expect(header({ icon: undefined })).not.toContain("size-6 text-primary")
  })
})

describe("PageHeader — the breadcrumb truncates to one line", () => {
  it("overrides the primitive's wrapping with flex-nowrap on the list", () => {
    const crumbs = breadcrumbBlock(header())

    // twMerge drops the primitive's `flex-wrap` when it sees `flex-nowrap`, so
    // the override lands last and `flex-wrap` is gone from the output.
    expect(crumbs).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(crumbs).not.toContain("flex-wrap")
  })

  it("allows the nav and the last item to shrink below their content", () => {
    const crumbs = breadcrumbBlock(header())

    // A flex item's default min-width:auto refuses to shrink below its
    // content, so without these the ellipsis can never engage.
    expect(crumbs).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(crumbs).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
  })

  it("truncates the page element, which is what draws the ellipsis", () => {
    expect(breadcrumbBlock(header())).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("builds the trail itself: one separator per crumb, page treatment last", () => {
    const crumbs = breadcrumbBlock(header())

    expect(crumbs.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(1)
    expect(crumbs).toContain(">Espace</span>")
    expect(crumbs).toContain(">Rapports</span>")
    // A three-item trail is a longer array, not a variant of the module.
    const deep = breadcrumbBlock(
      header({ crumbs: ["Espace", "Demandes de déplacement", "Nouvelle Demande"] })
    )
    expect(deep.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(2)
  })

  it("renders a middle crumb as a link back up the trail, callers passing text only", () => {
    const crumbs = breadcrumbBlock(
      header({
        crumbs: [
          "Espace",
          { label: "Demandes de déplacement", href: "/demandes" },
          "Nouvelle Demande",
        ],
      })
    )

    expect(crumbs).toContain('href="/demandes"')
    expect(crumbs).toContain(
      'class="transition-colors hover:text-foreground"'
    )
  })
})

describe("PageHeader — the desktop anatomy", () => {
  it("keeps the mt-6 rhythm between the breadcrumb row and the title row", () => {
    expect(header()).toContain('class="mt-6 flex items-center gap-4"')
  })

  it("renders the breadcrumb row above the title, not beside it", () => {
    const html = header()

    expect(html.indexOf('aria-label="breadcrumb"')).toBeLessThan(
      html.indexOf("Rapports</h1>")
    )
    // justify-between is what keeps a page's action top-right; gap-4 is the
    // minimum separation that only binds once the row is full.
    expect(html).toContain(
      'class="flex items-center justify-between gap-4"'
    )
  })

  it("renders the subtitle under the title", () => {
    const block = headerBlock(header())

    expect(block).toContain('class="mt-1 text-sm text-muted-foreground"')
    expect(block).toContain("Vue d&#x27;ensemble des demandes de déplacement")
  })

  it("takes no other breakpoint variant — md: is the single shell breakpoint", () => {
    const block = headerBlock(header())

    expect(block).not.toContain("sm:text-[")
    expect(block).not.toContain("lg:text-[")
    expect(block).not.toMatch(/(?:sm|lg):size-\d/)
  })
})

describe("PageHeader — the optional props", () => {
  it("renders no action region when the action is absent", () => {
    const html = header()
    const row = html.slice(
      html.indexOf('<div class="flex items-center justify-between gap-4">'),
      html.indexOf('<div class="mt-6 flex items-center gap-4">')
    )

    // The row holds the breadcrumb and nothing else: no wrapper, no gap
    // placeholder invented to stand in for a missing action.
    expect(row).toContain('aria-label="breadcrumb"')
    expect(row).not.toContain("shrink-0")
    expect(row).not.toContain("<button")
    expect(row.trimEnd().endsWith("</nav></div>")).toBe(true)
  })

  it("keeps the caller's own action markup in the slot, top-right of the title", () => {
    const html = header({
      action: <button className="shrink-0">Exporter</button>,
    })

    expect(html).toContain("Exporter")
    expect(html.indexOf("Exporter")).toBeLessThan(html.indexOf("Rapports</h1>"))
  })

  it("takes a subtitle that is a node carrying a live count", () => {
    // A count is a display concern; typing a domain concept into this
    // interface would re-centralise what the consolidation removed.
    const html = header({
      subtitle: (
        <>
          {42} utilisateur(s)
        </>
      ),
    })

    expect(html).toContain('class="mt-1 text-sm text-muted-foreground"')
    expect(html).toContain("42 utilisateur(s)")
  })

  it("renders the caller's icon in the tile", () => {
    expect(headerBlock(header({ icon: FileText }))).toContain(
      "lucide-file-text"
    )
  })
})
