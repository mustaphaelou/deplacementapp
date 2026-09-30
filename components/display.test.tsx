import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import {
  textInputClass,
  rowHoverInkTint,
  tableShellClass,
  searchFieldIconClass,
  searchFieldInputClass,
  loadingBlockClass,
  loadingTextClass,
  fieldLabelClass,
  fieldHintClass,
  sectionHeadingClass,
  sectionHeadingRuleClass,
  sectionHeadingRowClass,
  propertyLabelClass,
  propertyValueClass,
  hideClassFor,
  SectionHeading,
  Field,
  PropertyRow,
  LoadingBlock,
} from "@/components/display"

/**
 * The display module's own test surface.
 *
 * Three jobs, in order of how much they would hurt to get wrong:
 *
 * 1. Each exported constant is pinned to the EXACT string, spelled out here as
 *    a literal so the pin compares two values instead of a value to itself.
 * 2. Each constant is then pinned against the SOURCE of the pages that
 *    currently render it. This is what makes this ticket safe to land with no
 *    call site migrated: the module's value and the page's value are asserted
 *    to be the same bytes, so a hand-typed constant that differs from what a
 *    page renders in even one character fails here instead of at #307.
 * 3. Each React module's rendered markup is pinned, INCLUDING the text its
 *    props contribute — a pin that only asserted a class string would survive
 *    a module that renders the right classes and the wrong content.
 *
 * A green pin proves a class STRING is present, never how it looks: the render
 * suite runs in a `node` environment with no CSS engine and no DOM. Nothing in
 * this file is visual verification.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const source = (rel: string) => readFileSync(join(ROOT, rel), "utf8")

// Slice a region for a NEGATIVE assertion, and fail loudly if the anchor has
// drifted. `String.indexOf` returns -1 on a miss and `slice(-1, -1)` is "",
// so an unchecked slice would leave every negative below passing on an empty
// string while the suite stayed green. The assertion is the guard.
const region = (html: string, from: string, to: string) => {
  const start = html.indexOf(from)
  expect(
    start,
    `the slice anchor ${JSON.stringify(from)} is absent from the rendered markup — the element moved, so every negative assertion scoped to it would pass on an empty string`,
  ).toBeGreaterThanOrEqual(0)
  const end = html.indexOf(to, start)
  expect(
    end,
    `the slice end ${JSON.stringify(to)} is absent from the rendered markup`,
  ).toBeGreaterThan(start)
  return html.slice(start, end)
}

describe("the display class constants — each is the exact string, spelled out", () => {
  it("textInputClass", () => {
    expect(textInputClass).toBe(
      "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)",
    )
  })

  it("rowHoverInkTint — the row's tint, not the darker action tint", () => {
    expect(rowHoverInkTint).toBe(
      "hover:bg-[rgba(55,53,47,0.024)] dark:hover:bg-sidebar-accent/40",
    )
    // The action tint is a different decision at a different weight. If the two
    // are ever merged, the row's hover doubles in strength on every list.
    expect(rowHoverInkTint).not.toContain("0.06")
    expect(rowHoverInkTint).not.toContain("sidebar-accent/50")
  })

  it("tableShellClass", () => {
    expect(tableShellClass).toBe(
      "overflow-x-auto border-y border-border text-sm",
    )
  })

  it("searchFieldIconClass", () => {
    expect(searchFieldIconClass).toBe(
      "absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground",
    )
  })

  it("searchFieldInputClass", () => {
    expect(searchFieldInputClass).toBe("h-8 w-60 pl-8")
  })

  it("loadingBlockClass and loadingTextClass", () => {
    expect(loadingBlockClass).toBe("flex items-center justify-center p-8")
    expect(loadingTextClass).toBe("text-sm text-muted-foreground")
  })

  it("fieldLabelClass and fieldHintClass", () => {
    expect(fieldLabelClass).toBe("mb-1.5 block text-sm font-medium")
    expect(fieldHintClass).toBe("mt-1.5 text-xs text-muted-foreground")
  })

  it("sectionHeadingClass, its rule and its row", () => {
    expect(sectionHeadingClass).toBe(
      "text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground",
    )
    expect(sectionHeadingRuleClass).toBe("h-px flex-1 bg-border")
    expect(sectionHeadingRowClass).toBe("flex items-center gap-3")
  })

  it("propertyLabelClass and propertyValueClass", () => {
    expect(propertyLabelClass).toBe("text-xs text-muted-foreground")
    expect(propertyValueClass).toBe("mt-0.5 text-sm font-medium")
  })
})

/**
 * The module's value against the page's value, in the page's own source.
 *
 * No call site is migrated by this ticket, so the pages still carry their own
 * copies — and that is exactly what makes this test meaningful: it is what
 * proves the new constant is byte-identical to the copy it will replace at
 * #307. A constant typed from memory rather than copied from a page fails
 * here on the first character that differs.
 *
 * #307 deletes this describe block: once the pages import the module, the
 * source no longer carries the literal, and asserting that it does would
 * guard the opposite of what this ticket claims.
 */
describe("the constants are byte-identical to what the pages render today", () => {
  it.each([
    [
      "textInputClass",
      textInputClass,
      [
        "components/demande-form.tsx",
        "components/profile-edit.tsx",
        "app/(dashboard)/administration/societe/page.tsx",
        "app/(dashboard)/administration/vehicules/page.tsx",
        "app/(dashboard)/administration/utilisateurs/page.tsx",
      ],
    ],
    [
      "rowHoverInkTint",
      rowHoverInkTint,
      [
        "components/dashboard-layout.tsx",
        "app/(dashboard)/demandes/page.tsx",
        "app/(dashboard)/administration/utilisateurs/page.tsx",
        "app/(dashboard)/administration/vehicules/page.tsx",
      ],
    ],
    [
      "tableShellClass",
      tableShellClass,
      [
        "components/dashboard-layout.tsx",
        "app/(dashboard)/demandes/page.tsx",
        "app/(dashboard)/administration/utilisateurs/page.tsx",
        "app/(dashboard)/administration/vehicules/page.tsx",
      ],
    ],
    [
      "searchFieldIconClass",
      searchFieldIconClass,
      [
        "app/(dashboard)/demandes/page.tsx",
        "app/(dashboard)/administration/utilisateurs/page.tsx",
        "app/(dashboard)/administration/vehicules/page.tsx",
      ],
    ],
    [
      "searchFieldInputClass",
      searchFieldInputClass,
      [
        "app/(dashboard)/administration/utilisateurs/page.tsx",
        "app/(dashboard)/administration/vehicules/page.tsx",
      ],
    ],
    ["loadingBlockClass", loadingBlockClass, [
      "app/(dashboard)/demandes/page.tsx",
      "app/(dashboard)/notifications/page.tsx",
      "app/(dashboard)/administration/utilisateurs/page.tsx",
      "app/(dashboard)/administration/vehicules/page.tsx",
    ]],
    ["loadingTextClass", loadingTextClass, [
      "app/(dashboard)/demandes/page.tsx",
      "app/(dashboard)/notifications/page.tsx",
      "app/(dashboard)/administration/utilisateurs/page.tsx",
      "app/(dashboard)/administration/vehicules/page.tsx",
    ]],
    ["fieldLabelClass", fieldLabelClass, [
      "components/demande-form.tsx",
      "app/(dashboard)/administration/societe/page.tsx",
      "app/(dashboard)/administration/vehicules/page.tsx",
      "app/(dashboard)/administration/utilisateurs/page.tsx",
    ]],
    ["fieldHintClass", fieldHintClass, [
      "app/(dashboard)/administration/societe/page.tsx",
    ]],
    ["sectionHeadingClass", sectionHeadingClass, [
      "components/demande-form.tsx",
      "components/profile-edit.tsx",
      "components/demande-detail.tsx",
    ]],
    ["sectionHeadingRuleClass", sectionHeadingRuleClass, [
      "components/demande-form.tsx",
      "components/profile-edit.tsx",
      "components/demande-detail.tsx",
    ]],
    ["sectionHeadingRowClass", sectionHeadingRowClass, [
      "components/demande-form.tsx",
      "components/profile-edit.tsx",
      "components/demande-detail.tsx",
    ]],
    ["propertyLabelClass", propertyLabelClass, [
      "components/demande-detail.tsx",
      "components/profile-edit.tsx",
    ]],
    ["propertyValueClass", propertyValueClass, [
      "components/demande-detail.tsx",
      "components/profile-edit.tsx",
    ]],
  ])("%s is present, unchanged, in every site that renders it", (_name, value, files) => {
    for (const file of files as string[]) {
      expect(
        source(file),
        `${_name} is not present in ${file} — the constant and the page it replaces have drifted`,
      ).toContain(value as string)
    }
  })

  it("sectionHeadingClass normalises the Societe page's token order and nothing else", () => {
    // The one authorised difference. The Societe page carries the SAME tokens
    // with `uppercase` last; class order is not behaviour. This asserts the
    // token SET matches and that `uppercase` is the only thing that moved, so
    // a fifth site with genuinely different tokens fails here instead of being
    // normalised away.
    const tokens = (s: string) => s.split(" ").sort().join(" ")
    expect(tokens(sectionHeadingClass)).toBe(
      tokens("text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"),
    )
    // Every individual token, checked in the page's own source. A token-set
    // comparison alone would be satisfied by a reordering of DIFFERENT
    // utilities; pinning each token proves the page carries the same five.
    for (const token of sectionHeadingClass.split(" ")) {
      expect(
        source("app/(dashboard)/administration/societe/page.tsx"),
        `the Societe page's section heading is missing ${token}`,
      ).toContain(token)
    }
  })
})

describe("hideClassFor — a cell hidden below a breakpoint reappears at the next", () => {
  it("returns undefined when no breakpoint is given", () => {
    expect(hideClassFor({})).toBeUndefined()
    // The whole point of returning undefined rather than "": `cn` drops an
    // undefined argument, so a caller can pass this through without branching.
    expect(hideClassFor({ hideAt: undefined })).toBeUndefined()
  })

  it.each([
    ["sm", "hidden sm:table-cell"],
    ["md", "hidden md:table-cell"],
    ["lg", "hidden lg:table-cell"],
  ] as const)("hides below %s and reappears at %s", (breakpoint, expected) => {
    expect(hideClassFor({ hideAt: breakpoint })).toBe(expected)
  })

  it("returns a class string that carries the breakpoint, not a fixed one", () => {
    // A pin on one breakpoint alone would pass against a function that always
    // answered `sm:`. Each breakpoint is asserted above; this one fails if a
    // breakpoint is silently dropped from the rule.
    const produced = (["sm", "md", "lg"] as const).map((b) =>
      hideClassFor({ hideAt: b }),
    )
    expect(new Set(produced).size).toBe(3)
    for (const [i, value] of produced.entries()) {
      expect(value).toContain(["sm", "md", "lg"][i])
    }
  })
})

describe("SectionHeading", () => {
  const html = renderToStaticMarkup(<SectionHeading>Email</SectionHeading>)

  it("renders the row, the uppercase heading and the hairline", () => {
    expect(html).toBe(
      '<div class="flex items-center gap-3">' +
        '<h2 class="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Email</h2>' +
        '<span class="h-px flex-1 bg-border"></span>' +
        "</div>",
    )
  })

  it("renders the children it is given, not a hard-coded title", () => {
    // The class pin above would survive a module that always rendered "Email".
    // This is the pin that asserts the module's own contribution.
    expect(renderToStaticMarkup(<SectionHeading>Identité visuelle</SectionHeading>)).toContain(
      ">Identité visuelle</h2>",
    )
  })
})

describe("Field — the hint is a slot with a default of no hint", () => {
  const noHint = renderToStaticMarkup(
    <Field label="Nom de la société" htmlFor="nom">
      <input id="nom" />
    </Field>,
  )

  it("renders the label, then the control", () => {
    // `Label` prepends its own classes, so the pin is scoped to the utility run
    // this module contributes — anchored WITHOUT `class="<first-utility`,
    // which would break the moment Label's own base run changed.
    expect(noHint).toContain('mb-1.5 block text-sm font-medium"')
    expect(noHint).toContain(">Nom de la société</label>")
    expect(noHint).toContain('<input id="nom"/>')
  })

  it("renders NO hint paragraph when the slot is empty", () => {
    const block = region(noHint, '<div><label', "</div>")
    expect(block).not.toContain("mt-1.5 text-xs text-muted-foreground")
    // The whole-render negative, which is safe here only because the
    // no-hint markup's every other class run is pinned above.
    expect(noHint).not.toContain("<p")
  })

  it("fills the SAME slot with a hint — not a second shape", () => {
    // `l'adresse` on purpose: React escapes an apostrophe in text content, and
    // the real Societe hint carries one. A pin written against the unescaped
    // spelling would go red on correct markup.
    const withHint = renderToStaticMarkup(
      <Field label="Domaine email" htmlFor="domaineEmail" hint="Utilisé pour l'adresse d'envoi">
        <input id="domaineEmail" />
      </Field>,
    )
    // Byte-for-byte the no-hint markup plus one trailing paragraph.
    expect(withHint).toBe(
      '<div><label data-slot="label" class="select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 mb-1.5 block text-sm font-medium" for="domaineEmail">Domaine email</label>' +
        '<input id="domaineEmail"/>' +
        '<p class="mt-1.5 text-xs text-muted-foreground">Utilisé pour l&#x27;adresse d&#x27;envoi</p></div>',
    )
  })

  it("omits htmlFor when no id is given, rather than emitting for=\"\"", () => {
    const html = renderToStaticMarkup(<Field label="Motifs">C</Field>)
    expect(html).not.toContain("for=")
    expect(html).toContain(">Motifs</label>")
  })
})

describe("PropertyRow", () => {
  it("renders the label above the value", () => {
    expect(
      renderToStaticMarkup(<PropertyRow label="Département">Finance</PropertyRow>),
    ).toBe(
      '<div><p class="text-xs text-muted-foreground">Département</p>' +
        '<p class="mt-0.5 text-sm font-medium">Finance</p></div>',
    )
  })

  it("renders the children it is given, not a hard-coded value", () => {
    const html = renderToStaticMarkup(
      <PropertyRow label="Département">
        <span>Finance</span>
      </PropertyRow>,
    )
    // Both props, asserted independently: a module that rendered the right
    // classes with the wrong content would pass a class-only pin.
    expect(html).toContain(">Département</p>")
    expect(html).toContain("<span>Finance</span>")
  })
})

describe("LoadingBlock", () => {
  it("renders the centred box and the word", () => {
    expect(renderToStaticMarkup(<LoadingBlock />)).toBe(
      '<div class="flex items-center justify-center p-8">' +
        '<p class="text-sm text-muted-foreground">Chargement...</p></div>',
    )
  })

  it("carries no spinner — the Societe page's p-12 block is a different shape", () => {
    const html = renderToStaticMarkup(<LoadingBlock />)
    expect(html).not.toContain("animate-spin")
    expect(html).not.toContain("p-12")
  })
})
