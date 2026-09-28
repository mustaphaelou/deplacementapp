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

  it("honours the out-of-scope allowlist instead of filing on excluded surfaces", () => {
    // 403 is out of scope for #251 and owns a bare 40px title by decision.
    write("app/(protected)/403/page.tsx", `export default function P() {
  return <h1 className="text-[40px] font-bold">x</h1>
}
`)
    expect(runOnTree(dir).status).toBe(0)
  })
})
