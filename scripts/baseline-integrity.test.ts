import { describe, it, expect } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASELINE_PATH = join(ROOT, "docs/agents/testing.md")

/**
 * The suite count is a claim people make out loud — in a spec's acceptance
 * criteria, a PR body, a ticket's expected delta. This file exists because
 * such a claim was made from a dirty tree and was wrong by 9.
 *
 * An untracked scratch harness (`components/byte-identity.harness.test.tsx`,
 * self-labelled "TEMPORARY … deleted before the commit lands") sat in the
 * working tree across two sessions and a merge. Vitest collects it by
 * glob, so every count taken in that window included 9 tests that exist
 * nowhere but that laptop. The resulting 805 became the spec's stated
 * baseline for #260 and #261 and was reported back as verified evidence.
 *
 * A green suite says nothing about whether the number it produced is real.
 * These tests make the number checkable.
 */

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
}

/** Untracked files, minus the ones git already ignores. */
function untrackedFiles(): string[] {
  return git("ls-files", "--others", "--exclude-standard")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/** The globs vitest collects, from the project's own config. */
function vitestIncludeGlobs(): string[] {
  const config = readFileSync(join(ROOT, "vitest.config.ts"), "utf8")
  const include = config.match(/include:\s*(\[[^\]]*\]|"[^"]*")/)
  // The config sets no `include`, so vitest's default applies. Recorded here
  // explicitly because the default is what silently collected the harness.
  return include ? [include[1]] : ["**/*.{test,spec}.?(c|m)[jt]s?(x)"]
}

describe("the suite count is only meaningful on a clean tree", () => {
  it("has no untracked file that vitest would collect as a test", () => {
    // Scoped to test-shaped files on purpose: a developer with an untracked
    // notes file is not this guard's business. A scratch *test* silently
    // entering the count is.
    const collectable = untrackedFiles().filter((path) =>
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
    )

    expect(
      collectable,
      `untracked test files would be collected by vitest and inflate the suite ` +
        `count: ${collectable.join(", ")}. Move the scratch work out of the ` +
        `repo, or commit it if it is meant to count.`
    ).toEqual([])
  })

  it("names the collection globs it is defending against", () => {
    // If vitest's default include ever changes, this test's scope has to
    // change with it — a guard that silently stops covering is worse than
    // no guard, because it still reads as a pass.
    const globs = vitestIncludeGlobs()
    expect(globs.length).toBeGreaterThan(0)
    expect(globs.join(" ")).toContain("test")
  })

  it("records the baseline and how to re-measure it", () => {
    const docs = readFileSync(BASELINE_PATH, "utf8")

    // The count is a moving target by design, so the doc is not a number to
    // trust but a procedure to re-run. Both parts must be present.
    expect(docs).toContain("npm test")
    expect(docs).toContain("clean")
    expect(docs).toMatch(/\d+ passed/)
  })

  it("states the failure that motivated the guard, so it is not deleted as redundant", () => {
    const docs = readFileSync(BASELINE_PATH, "utf8")

    expect(docs).toContain("harness")
    expect(docs).toMatch(/\b80\d\b|\b79\d\b/)
  })
})
