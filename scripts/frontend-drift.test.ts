import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SCRIPT = join(ROOT, "scripts/frontend-drift.mjs")

/**
 * The drift checker is only worth its CI minute if it (a) stays silent on a
 * clean tree and (b) actually fires on each defect class it claims to police.
 *
 * A checker that only ever prints "clean" is indistinguishable from one that is
 * silently broken, so these tests inject each defect into a throwaway copy of
 * the real repo and assert the rule fires on that rule and only that rule.
 * Fixtures are built from the live tree rather than hand-written stubs, so a
 * rule cannot pass because a minimal stub happens to satisfy it.
 */
function runOnTree(dir: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [join(dir, "scripts/frontend-drift.mjs")], {
      cwd: dir,
      encoding: "utf8",
    })
    return { stdout, status: 0 }
  } catch (e: any) {
    return { stdout: `${e.stdout ?? ""}`, status: e.status ?? 1 }
  }
}

/** Copy only what the checker reads: app/ + components/ + the script. */
function scaffold(): string {
  const dir = mkdtempSync(join(tmpdir(), "drift-"))
  mkdirSync(join(dir, "scripts"), { recursive: true })
  cpSync(SCRIPT, join(dir, "scripts/frontend-drift.mjs"))
  cpSync(join(ROOT, "app"), join(dir, "app"), { recursive: true })
  cpSync(join(ROOT, "components"), join(dir, "components"), { recursive: true })
  return dir
}

let dir: string
beforeEach(() => {
  dir = scaffold()
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function appendTo(rel: string, code: string) {
  const p = join(dir, rel)
  writeFileSync(p, `${readFileSync(p, "utf8")}\n${code}\n`)
}
function write(rel: string, code: string) {
  const p = join(dir, rel)
  // New routes introduce directories the copied tree does not have yet.
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, code)
}

describe("frontend-drift checker — signal", () => {
  it("is silent on the real tree", () => {
    const { stdout, status } = runOnTree(ROOT)
    expect(stdout).toContain("clean")
    expect(status).toBe(0)
  })

  it("RULE_TITLE_RESPONSIVE fires on a bare 40px title", () => {
    appendTo(
      "components/page-header.tsx",
      `export const Drifted = () => <h1 className="text-[40px] font-bold">x</h1>`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_TITLE_RESPONSIVE")
  })

  it("RULE_TITLE_RESPONSIVE does not fire when the md: twin is present", () => {
    appendTo(
      "components/page-header.tsx",
      `export const Fine = () => <h1 className="text-[24px] font-bold md:text-[40px]">x</h1>`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_FOCUS_RING fires on outline-none with no ring (#252 class)", () => {
    write(
      "components/drift-probe.tsx",
      `export const Btn = () => (
  <button className="rounded-[3px] outline-none hover:bg-muted">x</button>
)
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_FOCUS_RING")
  })

  it("RULE_FOCUS_RING stays silent when hover styling keeps the UA ring", () => {
    // The inverse is NOT a defect: no outline-none means the browser's default
    // focus ring still renders. An earlier rule version flagged this shape and
    // produced six false positives against a clean tree.
    write(
      "components/drift-probe.tsx",
      `export const Link = () => (
  <a href="/x" className="text-sm transition-colors hover:text-foreground">x</a>
)
`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_FOCUS_RING sees a ring that lives on a later line of a cn() call", () => {
    // Regression: a /<button[^>]*>/ matcher stops at the `=>` arrow and never
    // reads the classes below it, so it flagged a control that is correct.
    // Both buttons here DO carry their ring; the first buries it three lines
    // down inside a multi-line cn() call, which is the shape that broke.
    write(
      "components/drift-probe.tsx",
      `import { cn } from "@/lib/utils"
export const Btn = ({ active }: { active: boolean }) => (
  <button
    className={cn(
      "rounded-[3px] outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-muted" : "hover:bg-muted"
    )}
    onClick={() => {}}
  >
    x
  </button>
)
export const Btn2 = () => (
  <button className="outline-none focus-visible:ring-2 focus-visible:ring-ring">y</button>
)
`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_HEADER_ADOPTION fires on a new route that hand-rolls its header", () => {
    write(
      "app/(dashboard)/drift/page.tsx",
      `export default function Page() {
  return <h1 className="text-[24px] font-bold md:text-[40px]">Drift</h1>
}
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_HEADER_ADOPTION")
  })

  it("RULE_HEADER_ADOPTION accepts a route delegating to a header component", () => {
    // A thin route renders the header in its component; resolving only the
    // route's own source reported it as having no header at all.
    write(
      "app/(dashboard)/delegated/page.tsx",
      `import { DemandeDetail } from "@/components/demande-detail"
export default function Page() {
  return <DemandeDetail />
}
`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_OUTLINE_HAIRLINE fires on a bare outline used as a hairline", () => {
    write(
      "components/drift-probe.tsx",
      `export const Row = () => <div className="outline outline-border">x</div>
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_OUTLINE_HAIRLINE")
  })

  it("RULE_INK_TINT_RATCHET fires only when duplication GROWS past baseline", () => {
    const before = runOnTree(dir)
    expect(before.status).toBe(0)

    // Baseline is 4 files per literal. A fifth copy is new debt.
    write(
      "components/drift-tint.tsx",
      `export const T = () => <div className="hover:bg-[rgba(55,53,47,0.024)]" />
export const U = () => <div className="hover:bg-[rgba(55,53,47,0.06)]" />
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_INK_TINT_RATCHET")
  })

  it("does not flag the remapped radius scale as drift", () => {
    // globals.css remaps --radius-lg to 3px, so the ~30 rounded-lg uses in
    // components/ui are CORRECT. A "rounded-lg means 8px" rule would file a
    // ticket against every one of them on its first run.
    write(
      "components/drift-radius.tsx",
      `export const A = () => <div className="rounded-lg" />
export const B = () => <div className="rounded-md" />
export const C = () => <div className="rounded-[3px]" />
export const D = () => <div className="rounded-full" />
`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_RADIUS_SCALE fires on the NAMED scale, not just arbitrary values", () => {
    // Regression: the rule read
    //   if (RADIUS_OVER.test(token) || RADIUS_ALLOWED.has(token)) continue
    // which exempted exactly the utilities RADIUS_OVER names. `rounded-xl` is
    // the ORDINARY way the radius drifts, and it was silent; only an arbitrary
    // `rounded-[8px]` fired. Each named step is now its own finding.
    for (const token of ["rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-4xl"]) {
      write("components/drift-radius-named.tsx", `export const N = () => <div className="${token}" />\n`)
      const { stdout, status } = runOnTree(dir)
      expect(status, `${token} must fire`).toBe(1)
      expect(stdout).toContain("RULE_RADIUS_SCALE")
      expect(stdout).toContain("above the 3px spec")
      rmSync(join(dir, "components/drift-radius-named.tsx"), { force: true })
    }
  })

  it("RULE_RADIUS_SCALE still fires on an arbitrary radius value", () => {
    // The other half of the rule, and the half that did work: a value the
    // scale never defines.
    write("components/drift-radius-arbitrary.tsx", `export const X = () => <div className="rounded-[8px]" />\n`)
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_RADIUS_SCALE")
    expect(stdout).toContain("unrecognised radius utility")
  })

  it("RULE_TITLE_RESPONSIVE sees an md: twin on a LATER line of a cn() call", () => {
    // Regression: the rule tested `line.includes("md:text-[40px]")` against the
    // token's own line, so a correct multi-line cn() — the same shape that broke
    // RULE_FOCUS_RING and was fixed with openingTagAt — fired a false positive
    // here. The sibling rule was fixed; this one was left behind.
    write(
      "components/drift-probe.tsx",
      `import { cn } from "@/lib/utils"
export const Title = () => (
  <h1
    className={cn(
      "text-[40px] font-bold",
      "md:text-[40px]"
    )}
  >
    x
  </h1>
)
`
    )
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_TITLE_RESPONSIVE still fires when the multi-line cn() has NO twin", () => {
    // The false-positive fix must not become a blind spot: the same multi-line
    // shape with the twin removed is the real defect and must still be caught.
    write(
      "components/drift-probe.tsx",
      `import { cn } from "@/lib/utils"
export const Title = () => (
  <h1
    className={cn(
      "text-[40px] font-bold",
      "tracking-tight"
    )}
  >
    x
  </h1>
)
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_TITLE_RESPONSIVE")
  })

  it("allowlisting is BY FILE — exact path, no glob, no source-text fallback", () => {
    // Regression (#322): isAllowlisted had a fallback branch testing whether an
    // ALLOWLIST KEY appeared as a substring of a LINE OF SOURCE. A key like
    // `app/(auth)/login/setup-wizard.tsx` never appears inside a .tsx line, so
    // that branch was unreachable — and it read to a maintainer as "add a glob
    // here". Structural assertion: the branch is gone, and the signature no
    // longer takes a source line at all.
    const src = readFileSync(SCRIPT, "utf8")
    // Assert against CODE, not prose: the fix's own doc comment quotes the
    // removed expression, so matching the raw file tests the comment.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(code).not.toMatch(/function isAllowlisted\(rule, relPath, line\)/)
    expect(code).not.toMatch(/\.some\(\(\[pat/)
    expect(code).toMatch(/function isAllowlisted\(rule, relPath\)/)

    // Behavioural half: the key is an EXACT path. `components/profile-edit.tsx`
    // is the allowlisted file for RULE_HEADER_ADOPTION, and the real /profil
    // route delegates to it — so that delegation is silent by decision. A
    // sibling component is NOT allowlisted and is still judged. This is what a
    // reintroduced prefix or glob match would break.
    appendTo(
      "components/profile-edit.tsx",
      `export const Extra = () => <h1 className="text-[24px]">x</h1>\n`
    )
    expect(runOnTree(dir).status, "the allowlisted component stays silent").toBe(0)

    write(
      "components/drift-header-sibling.tsx",
      `export const Sibling = () => <h1 className="text-[24px]">x</h1>\n`
    )
    write(
      "app/(dashboard)/drift-sibling/page.tsx",
      `import { Sibling } from "@/components/drift-header-sibling"
export default function Page() {
  return <Sibling />
}
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status, "a sibling sharing the prefix is NOT allowlisted").toBe(1)
    expect(stdout).toContain("RULE_HEADER_ADOPTION")
  })

  it("honours the out-of-scope allowlist instead of filing on excluded surfaces", () => {
    // 403 is out of scope for #251 and owns a bare 40px title by decision.
    write("app/(protected)/403/page.tsx", `export default function P() {
  return <h1 className="text-[40px] font-bold">x</h1>
}
`)
    expect(runOnTree(dir).status).toBe(0)
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET fires on a re-declared display constant", () => {
    const before = runOnTree(dir)
    expect(before.status, "the real tree starts at its baseline").toBe(0)

    // The exact FIELD_INPUT shape in components/profile-edit.tsx: a module that
    // stops importing the constant and spells the class string again. This is
    // the defect the rule is FOR, so it has to be the real file mutated in
    // place rather than a hand-written stub — a stub would pass even if the
    // rule matched on something a stub cannot carry (the import line, the
    // constant's NAME, the surrounding JSX).
    //
    // textInputClass is ratcheted at 2 files, so a THIRD copy is new debt.
    // `app/(dashboard)/demandes/page.tsx` currently imports hideClassFor,
    // rowHoverInkTint and tableShellClass from the module.
    const page = "app/(dashboard)/demandes/page.tsx"
    const src = readFileSync(join(dir, page), "utf8")
    expect(src).toContain('from "@/components/display"')

    // Drop the import and re-declare the value locally, the way profile-edit
    // spells its own FIELD_INPUT.
    const withoutImport = src.replace(/import \{[^}]*\} from "@\/components\/display"\n/, "")
    expect(withoutImport, "the import was actually removed").not.toContain(
      'from "@/components/display"'
    )
    write(
      page,
      `const FIELD_INPUT = "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"\n\n${withoutImport}`
    )

    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_DISPLAY_CONSTANT_RATCHET")
    expect(stdout).toContain("textInputClass")
    // The finding names the offending file, so a maintainer knows where to look.
    expect(stdout).toContain(page)
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET is silent on a module that IMPORTS the constant", () => {
    // The inverse, and the half that catches a rule matching on the import
    // NAME or on `from "@/components/display"` instead of on the value. Four
    // covered constants are in play here, including the two zero-baseline ones
    // that no file spells out today.
    write(
      "components/drift-display-importer.tsx",
      `import {
  tableShellClass,
  searchFieldInputClass,
  fieldHintClass,
  fieldLabelClass,
} from "@/components/display"
export const Importer = () => (
  <div className={tableShellClass}>
    <input className={searchFieldInputClass} />
    <span className={fieldHintClass}>{fieldLabelClass}</span>
  </div>
)
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status, stdout).toBe(0)
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET counts FILES, not occurrences", () => {
    // Regression: `fieldLabelClass` is spelled eleven times across TWO files
    // (demande-form 3, profile-edit 8) and its baseline is 2. An occurrence
    // count would read 11 there and blow the baseline on a clean tree, forcing
    // either a permanent red or a baseline that no longer describes the tree —
    // the "cry wolf" outcome that gets a checker ignored. The unit is distinct
    // FILES, matching RULE_INK_TINT_RATCHET.
    //
    // The proof adds five MORE sites to a file that ALREADY holds the string, so
    // the occurrence count moves (16) while the file count does not (still 2).
    // An occurrence-counting implementation fires here; this one must not.
    // Adding the string to a NEW file is the other case and does fire — that is
    // the first test in this block.
    const holder = "components/demande-form.tsx"
    expect(
      readFileSync(join(dir, holder), "utf8"),
      "demande-form is already one of the two baseline holders"
    ).toContain("mb-1.5 block text-sm font-medium")

    const extra = [1, 2, 3, 4, 5]
      .map((n) => `<Label className="mb-1.5 block text-sm font-medium">extra-${n}</Label>`)
      .join("\n")
    appendTo(
      holder,
      `export const ExtraLabels = () => (\n  <div>\n    ${extra}\n  </div>\n)`
    )

    const { stdout, status } = runOnTree(dir)
    expect(status, `five more sites in an EXISTING holder is still two files:\n${stdout}`).toBe(0)
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET fires when a constant reaches a NEW file", () => {
    // The other half of the files-not-occurrences pin, and the direction the
    // ratchet exists for: one more FILE is new debt even though the string was
    // already in the tree. `fieldHintClass` is ratcheted at ZERO, so this is a
    // single new holder with one site.
    write(
      "components/drift-hint-copy.tsx",
      `export const Hint = () => <p className="mt-1.5 text-xs text-muted-foreground">hint</p>
`
    )
    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_DISPLAY_CONSTANT_RATCHET")
    expect(stdout).toContain("fieldHintClass")
    expect(stdout).toContain("components/drift-hint-copy.tsx")
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET does not judge the module against itself", () => {
    // The module holds every one of these strings BY DEFINITION. Counting it
    // would fire the rule on the source of truth — the same class of bug
    // RULE_HEADER_ADOPTION documents for page-header.tsx, which is filtered
    // out of its delegate candidates for exactly this reason.
    //
    // `tableShellClass` is ratcheted at ZERO, so this only holds because the
    // module is skipped. Read its census through the CLI to prove the skip is
    // real rather than incidental.
    const { stdout, status } = runOnTree(dir)
    expect(status, `the module must not be counted against itself:\n${stdout}`).toBe(0)
    const census = execFileSync("node", [SCRIPT, "--census"], { encoding: "utf8" })
    expect(census).toContain("tableShellClass: 0")
    expect(census).toContain("searchFieldIconClass: 0")
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET reports a covered constant the module stopped exporting", () => {
    // A hole that looks like a clean run: if `fieldHintClass` is renamed or
    // deleted in components/display.tsx, its baseline would silently stop being
    // checked and the rule would go quiet on a tree that had just gained a copy
    // of that geometry. The rule fails on the dangling reference instead.
    const p = join(dir, "components/display.tsx")
    const src = readFileSync(p, "utf8")
    write("components/display.tsx", src.replace(/export const fieldHintClass =/, "export const fieldHintRenamed ="))

    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_DISPLAY_CONSTANT_RATCHET")
    expect(stdout).toContain("fieldHintClass")
    expect(stdout).toContain("no longer exports it")
  })

  it("RULE_DISPLAY_CONSTANT_RATCHET fails on an exported constant nobody classified", () => {
    // The named failure mode of this rule: a SILENTLY SMALLER rule set. A new
    // export in components/display.tsx that is neither ratcheted nor excluded
    // would widen the module's ownership while the rule quietly stopped
    // watching it — and a gate that shrinks without saying so is worse than no
    // gate. The constant has to be classified on purpose.
    //
    // This also keeps DISPLAY_CONSTANT_EXCLUDED load-bearing: dropping the last
    // excluded name would turn that list into decoration.
    const p = join(dir, "components/display.tsx")
    const src = readFileSync(p, "utf8")
    appendTo("components/display.tsx", `export const brandNewClass = "tracking-tight italic"`)

    const { stdout, status } = runOnTree(dir)
    expect(status).toBe(1)
    expect(stdout).toContain("RULE_DISPLAY_CONSTANT_RATCHET")
    expect(stdout).toContain("brandNewClass")
    expect(stdout).toContain("unclassified")

    // ...and every constant that IS classified stays quiet, so the guard is not
    // just "any module edit fails".
    rmSync(p)
    write("components/display.tsx", src)
    expect(runOnTree(dir).status, "the unmodified module still classifies cleanly").toBe(0)
  })
})
