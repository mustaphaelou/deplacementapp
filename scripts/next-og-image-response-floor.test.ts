import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * GHSA-vcvr-r3jv-pc5j — Remote Code Execution in `next/og` ImageResponse.
 * Dependabot alert #49. Critical (CVSS 4.0 9.5), CWE-1395.
 *
 * The Node.js implementation of `ImageResponse` builds its output through
 * Satori, which — before 0.33.5 — failed to escape certain values before
 * placing them into the generated SVG. An application is exposed when it uses
 * the Node runtime AND passes attacker-controlled data into SVG content,
 * attributes or styles; the crafted value is then interpreted as SVG markup
 * instead of inert text, which escalates to code execution. Vercel shipped the
 * fix out of band in Next.js 16.3.6 (15.5.26 carried hardening only, and the
 * Edge implementation was never in scope).
 *
 * This app is not currently exposed: a census of the tree finds no
 * `next/og` import, no `ImageResponse` route, no `opengraph-image` /
 * `twitter-image` convention file and no `@vercel/og` dependency. What the
 * census does NOT protect is the floor itself. `next` is a caret range, and a
 * later dependency group — or a single `npm install next@...` — can walk the
 * resolved version back into `>= 16.2.0, < 16.3.6` without touching a single
 * application file. The day the first OG route lands, the version is the only
 * thing standing between it and a critical RCE.
 *
 * So this pin holds the version, in the two places it can be lost:
 *   - the LOCKFILE, which is what `npm ci` and the Docker build actually install;
 *   - the MANIFEST RANGE, because a floor in the lock alone is defeated by an
 *     `npm install` that re-resolves a looser declared range.
 *
 * Both are asserted against the advisory's own patched version, 16.3.6. A pin
 * that named "the version currently installed" would be a tautology: it would
 * pass on whatever a bad install produced and only fail on the NEXT bad change.
 */

/** `first_patched_version` on GHSA-vcvr-r3jv-pc5j. */
const ADVISORY = "GHSA-vcvr-r3jv-pc5j"
const MINIMUM_SAFE_VERSION = "16.3.6"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

type Semver = { major: number; minor: number; patch: number }

function parseSemver(version: string): Semver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. */
function compare(a: Semver, b: Semver): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

/**
 * The lowest version a declared range can resolve to.
 *
 * Only the range shapes this repo actually uses are handled, and anything else
 * FAILS CLOSED by returning null. A permissive range such as `*`, `latest` or an
 * unrecognised comparator admits a vulnerable version without naming one, so
 * "I could not parse it" must never be smoothed into "it looks safe".
 */
function rangeFloor(range: string): Semver | null {
  const trimmed = range.trim()
  const floor =
    /^[\^~]?(\d+\.\d+\.\d+)$/.exec(trimmed) ?? /^>=\s*(\d+\.\d+\.\d+)$/.exec(trimmed)
  if (!floor) return null
  return parseSemver(floor[1]!)
}

const manifest = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
) as { dependencies?: Record<string, string> }

const lockfile = JSON.parse(
  readFileSync(join(REPO_ROOT, "package-lock.json"), "utf8"),
) as { packages?: Record<string, { version?: string }> }

const declaredRange = manifest.dependencies?.next
const resolved = lockfile.packages?.["node_modules/next"]?.version

describe(`next is at or above the ${ADVISORY} patched version`, () => {
  it("resolves the next entry in the lockfile", () => {
    // The anchor. Without this, a missing or renamed lockfile entry yields
    // `undefined`, every comparison against it is vacuously satisfied, and the
    // whole gate reports green having asserted nothing.
    expect(declaredRange, "package.json declares a `next` dependency").toBeTruthy()
    expect(
      lockfile.packages?.["node_modules/next"],
      "package-lock.json has a node_modules/next entry",
    ).toBeDefined()
    expect(resolved, "the locked next entry carries a version").toBeTruthy()
  })

  it(`locks next to ${MINIMUM_SAFE_VERSION} or newer`, () => {
    const installed = parseSemver(resolved!)
    expect(installed, `locked next version ${resolved} is semver`).not.toBeNull()

    expect(
      compare(installed!, parseSemver(MINIMUM_SAFE_VERSION)!),
      `next ${resolved} is below ${MINIMUM_SAFE_VERSION}, the version that fixes ${ADVISORY}. Upgrade before any next/og surface is added.`,
    ).toBeGreaterThanOrEqual(0)
  })

  it(`declares a next range that cannot resolve below ${MINIMUM_SAFE_VERSION}`, () => {
    const floor = rangeFloor(declaredRange!)
    expect(
      floor,
      `declared range "${declaredRange}" names a concrete minimum. An unparseable range can resolve into the vulnerable window without naming it, so this pin fails closed rather than assuming.`,
    ).not.toBeNull()

    expect(
      compare(floor!, parseSemver(MINIMUM_SAFE_VERSION)!),
      `declared range "${declaredRange}" permits a version below ${MINIMUM_SAFE_VERSION}. The lockfile floor is defeated by an npm install that re-resolves this range.`,
    ).toBeGreaterThanOrEqual(0)
  })
})