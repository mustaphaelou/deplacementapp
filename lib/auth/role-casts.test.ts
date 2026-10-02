import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Ticket #297: « No `as Role` remains in production code ».
 *
 * Typecheck alone CANNOT enforce this criterion, and the reason is worth
 * stating because it is what makes the pin below necessary rather than
 * decorative. Once `AuthUser.role` is the union, `user.role as Role` is a no-op
 * that every type-checker accepts — the value already has the type the cast
 * claims. So the ten casts #297 deleted are not detectable by putting one back;
 * `tsc` stays green, the suite stays green, and the criterion silently lapses.
 * A reviewer reading this ticket's own criterion needs something that notices.
 *
 * Hence a SOURCE pin. It reads the production tree, and it allows exactly one
 * `as Role`, in one file, for the one documented reason: the navigation table's
 * keys are keyed permissively on purpose, so a navigation entry for a Role this
 * build does not have must not crash a page. `roles.ts` is that carve-out and
 * `roles.test.ts` pins the property that makes it safe.
 *
 * The carve-out is stated as an exact allowance, not as "roles.ts is allowed to
 * hold casts" — otherwise this file would happily accept a cast someone adds
 * next to the real one, and a pin that cannot see a second defect is not a pin.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Production roots. Tests and node_modules are excluded by the walk. */
const PRODUCTION_ROOTS = ["app", "lib", "components", "db", "scripts"]

/** The one file allowed to hold an `as Role`, and the one reason it may. */
const CARVE_OUT = {
  file: "lib/auth/roles.ts",
  reason:
    "the navigation table's keys are keyed permissively on purpose — a navigation entry for a Role this build does not have must not crash a page",
}

function productionFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...productionFiles(abs))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(abs)
    }
  }
  return out
}

/** Every `as Role` in production, as file:line, with comments and strings out. */
function findRoleCasts(): { site: string; line: number; text: string }[] {
  const found: { site: string; line: number; text: string }[] = []
  for (const root of PRODUCTION_ROOTS) {
    const abs = join(REPO_ROOT, root)
    let files: string[] = []
    try {
      files = productionFiles(abs)
    } catch {
      continue // an absent root is not a failure of this pin
    }
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      // Strip comments first: a comment that NAMES the cast — such as the
      // carve-out's own justification above — must not read as a cast site.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
      code.split("\n").forEach((text, i) => {
        if (/\bas\s+Role\b/.test(text)) {
          found.push({
            site: relative(REPO_ROOT, file).split("\\").join("/"),
            line: i + 1,
            text: text.trim(),
          })
        }
      })
    }
  }
  return found
}

describe("no `as Role` in production", () => {
  const casts = findRoleCasts()

  it("leaves exactly one, and it is the documented carve-out", () => {
    // The failure line names every offender, because "no `as Role` remains"
    // with no site list is the kind of pin nobody can act on.
    const offenders = casts.filter((c) => c.site !== CARVE_OUT.file)
    expect(
      offenders.map((c) => `${c.site}:${c.line}  ${c.text}`).join("\n") ||
        "(none)"
    ).toBe("(none)")

    // And the carve-out is still there, so deleting it is a deliberate edit to
    // this file rather than something that happens by accident.
    expect(
      casts.filter((c) => c.site === CARVE_OUT.file),
      `${CARVE_OUT.file} must keep exactly one \`as Role\` — ${CARVE_OUT.reason}`
    ).toHaveLength(1)
  })

  // `roles.test.ts` pins the property the carve-out exists to protect. This
  // case states why the allowance is safe to make at all, so the two pins read
  // as one decision rather than a loophole and a separate test.
  it("the carve-out is the navigation lookup and nothing else", () => {
    const carve = casts.filter((c) => c.site === CARVE_OUT.file)
    expect(carve).toHaveLength(1)
    expect(carve[0].text).toContain("navItemsForRole")
  })

  // Non-vacuity: this file must be able to SEE a cast. A walk that stopped
  // walking — a renamed root, a bad glob, a `continue` that swallowed
  // everything — would report « exactly one » forever, and the pin above would
  // be indistinguishable from a walk that finds nothing. So a real file is
  // planted inside a walked root, the walk is re-run, and the file is removed
  // again in a `finally` so the tree is never left dirty.
  it("sees a cast planted inside the tree it walks, and sees it gone", () => {
    const probe = join(REPO_ROOT, "lib", "__role_cast_probe__.ts")
    expect(findRoleCasts()).toHaveLength(1)

    try {
      writeFileSync(probe, "const role = stored as Role\nexport default role\n")
      const withProbe = findRoleCasts()
      expect(withProbe).toHaveLength(2)
      expect(
        withProbe.some((c) => c.site === "lib/__role_cast_probe__.ts" && c.line === 1)
      ).toBe(true)
    } finally {
      rmSync(probe, { force: true })
    }

    expect(findRoleCasts()).toHaveLength(1)
  })
})