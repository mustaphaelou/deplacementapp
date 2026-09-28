import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The wiring check for spec #281 / ticket #286.
 *
 * The defect this spec fixes was not one wrong answer — it was THREE
 * SPELLINGS of one question, kept in step by hand, disagreeing with nothing
 * because nothing compared them. Declaring the set (#282) stops the
 * re-derivation. This file stops the OMISSION: the failure mode of the whole
 * class is an administration surface someone adds (or one that quietly goes
 * back to naming Roles) and no test notices.
 *
 * So the rule is structural rather than behavioural: it reads the surfaces'
 * SOURCE and fails when one governs access without asking
 * `ROLES_MANAGEMENT`. A behavioural test passes against a surface that asked
 * the guard and got the wrong set; only a source check notices a surface that
 * stopped asking.
 *
 * It runs in two directions, because one alone is gameable:
 *
 *   1. FORWARD — every surface in ADMINISTRATION_SURFACES names
 *      ROLES_MANAGEMENT. Drop one and it fails.
 *   2. BACKWARD — every file under app/ that makes a Role-based access
 *      decision is either a surface asking the set, or accounted for on
 *      NON_ADMINISTRATION with the question it actually answers. A NEW surface
 *      that names Roles lands here unaccounted and fails. The forward
 *      direction alone cannot catch that: a new file is simply absent from the
 *      list.
 *
 * The backward direction costs one line in NON_ADMINISTRATION per legitimate
 * Role-naming site. That is the price of the list being exhaustive — an
 * allowlist nobody can extend silently is the only kind that still means
 * something — and each entry cites the spec clause that puts the site out of
 * scope.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * The surfaces that govern access to Utilisateurs, the Societe write, the
 * Societe identity read, the fleet writes, the export and Rapports. Each asks
 * the declared set, and each names NO Role at all — these files have no
 * pipeline business, so a Role literal in one is a second spelling.
 *
 * Kept as an explicit list on purpose: a derived one (say « every route under
 * /administration ») would silently pass when a surface is renamed, moved or
 * spelled a fourth way — the exact failure this ticket exists to catch.
 */
const ADMINISTRATION_SURFACES: readonly string[] = [
  "app/api/utilisateurs/route.ts",
  "app/api/societe/route.ts",
  "app/api/societe/identity/route.ts",
  // All three fleet writes live in this one file. Its GET is deliberately
  // unguarded (#284) — only the writes are administration.
  "app/api/vehicules/route.ts",
  "app/api/csv/route.ts",
  "app/(dashboard)/administration/rapports/page.tsx",
]

/**
 * Surfaces that ask the set for their ADMINISTRATION question and legitimately
 * name Roles for a different one. The spec's out-of-scope list is the
 * authority: the pipeline lanes belong to the workflow module, which owns the
 * Etape-to-Role pairing.
 *
 * These are held to the weaker, still-meaningful rule — a member of the
 * declared set is never named literally here. A pipeline Role may be named; a
 * management Role may not, because naming one would be re-deriving the answer
 * this spec centralised.
 */
const HYBRID_SURFACES: readonly string[] = [
  // The Demandes list page offered the export through its own inline Role
  // comparison — the one site of the eight that reached around the guard
  // interface, which is why it could drift from /api/csv's own guard with
  // nothing to catch it (#286). It now asks the set. Its EMPLOYEE comparisons
  // are the pipeline lanes (the « Nouvelle demande » link, the Brouillons tab,
  // the « Mes demandes » title) and stay.
  "app/(dashboard)/demandes/page.tsx",
]

/**
 * Files under app/ that make a Role-based access decision without asking the
 * set, because they answer a DIFFERENT question. Each entry names that
 * question.
 */
const NON_ADMINISTRATION: Readonly<Record<string, string>> = {
  // The pipeline lane: who may CREATE a DemandeDeplacement. A workflow fact
  // (spec #281 « Out of Scope — The pipeline lanes »), fixed by the settled
  // Etape-to-Role pairing in lib/workflow.ts.
  "app/api/demandes/route.ts":
    "pipeline lane — creation is EMPLOYEE's, per lib/workflow.ts",
  // The Utilisateurs screen's role PICKER: the default value a new account is
  // created with. It grants nothing — the POST/PUT guards do — and ADR-0021
  // enumerates the picker and the who-can-grant rules separately (spec #281
  // « Out of Scope — The Utilisateurs screen's role picker »).
  "app/(dashboard)/administration/utilisateurs/page.tsx":
    "role picker — the default Role a new Utilisateur is created with, not a grant",
}

/** Directories that hold no app surface. */
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "coverage"])

function* appFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* appFiles(full)
    } else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) {
      yield full
    }
  }
}

/** Strip comments, so a comment explaining the rule may quote a Role name. */
const code = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")

// Two forms on purpose. The global one is for `match()` (which needs /g to
// collect every occurrence); the plain one is for `test()`, which on a /g
// regex carries `lastIndex` between calls and would make a file "decide
// access" on one call and not on the next.
const ROLE_LITERAL_G = /["'`](EMPLOYEE|MANAGER|FINANCE_ADMIN|GENERAL_DIRECTION)["'`]/g
const ROLE_LITERAL = /["'`](EMPLOYEE|MANAGER|FINANCE_ADMIN|GENERAL_DIRECTION)["'`]/

/** Does this file make a Role-based access decision at all? */
function decidesAccess(source: string): boolean {
  return (
    /\bROLES_MANAGEMENT\b/.test(source) ||
    /\b(requireRole|requireAnyRole|hasAnyRole)\b/.test(source) ||
    ROLE_LITERAL.test(code(source))
  )
}

const readSurface = (relPath: string): string =>
  readFileSync(join(REPO_ROOT, relPath), "utf8")

const asksTheSet = (source: string): boolean =>
  /\bROLES_MANAGEMENT\b/.test(source)

/** Is this file accounted for — an administration surface, or explained? */
const isAccountedFor = (relPath: string, source: string): boolean =>
  !decidesAccess(source) ||
  ADMINISTRATION_SURFACES.includes(relPath) ||
  HYBRID_SURFACES.includes(relPath) ||
  relPath in NON_ADMINISTRATION

describe("every administration surface asks the declared set", () => {
  for (const surface of [...ADMINISTRATION_SURFACES, ...HYBRID_SURFACES]) {
    it(`${surface} names ROLES_MANAGEMENT`, () => {
      expect(asksTheSet(readSurface(surface))).toBe(true)
    })
  }

  // Non-vacuity. A check whose surface list silently emptied passes forever,
  // and an empty list would make every test above vanish while the suite
  // stayed green. The count and the members are pinned.
  it("the surface lists are the ones #281 named, and are not empty", () => {
    expect(ADMINISTRATION_SURFACES.length).toBe(6)
    expect(HYBRID_SURFACES.length).toBe(1)
    for (const expected of [
      "app/api/utilisateurs/route.ts",
      "app/api/societe/route.ts",
      "app/api/societe/identity/route.ts",
      "app/api/vehicules/route.ts",
      "app/api/csv/route.ts",
      "app/(dashboard)/administration/rapports/page.tsx",
    ]) {
      expect(ADMINISTRATION_SURFACES).toContain(expected)
    }
    expect(HYBRID_SURFACES).toContain("app/(dashboard)/demandes/page.tsx")
  })

  // The pin above proves the lists hold the right members. This proves every
  // member still EXISTS — a renamed or moved surface would otherwise make
  // readFileSync throw ENOENT and fail the whole file rather than naming the
  // surface that moved.
  it("every listed surface still exists at its path", () => {
    for (const surface of [...ADMINISTRATION_SURFACES, ...HYBRID_SURFACES]) {
      expect(() => statSync(join(REPO_ROOT, surface)), surface).not.toThrow()
    }
  })

  it("no surface sits in two categories at once", () => {
    for (const surface of HYBRID_SURFACES) {
      expect(ADMINISTRATION_SURFACES).not.toContain(surface)
      expect(surface in NON_ADMINISTRATION).toBe(false)
    }
    for (const surface of ADMINISTRATION_SURFACES) {
      expect(surface in NON_ADMINISTRATION).toBe(false)
    }
  })
})

describe("no surface reaches around the declared set", () => {
  // The backward direction, and the one that catches a NEW surface: a file
  // making an access decision is either a known surface or has to say on
  // NON_ADMINISTRATION which different question it answers. A new
  // administration surface lands here naming Roles, is on no list, and fails.
  it("every app file deciding access asks the set or is accounted for", () => {
    const unaccounted: string[] = []

    for (const file of appFiles(join(REPO_ROOT, "app"))) {
      const relPath = relative(REPO_ROOT, file)
      const source = readFileSync(file, "utf8")
      if (!isAccountedFor(relPath, source)) unaccounted.push(relPath)
    }

    expect(
      unaccounted,
      "these files make a Role-based access decision without asking ROLES_MANAGEMENT. " +
        "If one is an administration surface, add it to ADMINISTRATION_SURFACES. " +
        "If it answers a different question (a pipeline lane, the role picker), " +
        "add it to NON_ADMINISTRATION with the question it answers.",
    ).toEqual([])
  })

  // An administration surface has no pipeline business, so a Role literal in
  // one is a second spelling. (The set's declaration and the navigation live
  // in lib/auth/roles.ts, outside app/, so they are unaffected.)
  for (const surface of ADMINISTRATION_SURFACES) {
    it(`${surface} names no Role of its own`, () => {
      expect(code(readSurface(surface)).match(ROLE_LITERAL_G) ?? []).toEqual([])
    })
  }

  // A hybrid surface asks the set for its administration question and names
  // Roles for the pipeline. A member of the DECLARED SET named literally is
  // the re-derivation this spec removed, so that stays forbidden even here.
  for (const surface of HYBRID_SURFACES) {
    it(`${surface} names no member of the declared set`, () => {
      for (const role of ROLES_MANAGEMENT) {
        expect(code(readSurface(surface)), `${surface} names ${role}`).not.toMatch(
          new RegExp(`["'\`]${role}["'\`]`),
        )
      }
    })
  }

  // The reason the old wiring was possible: `hasAnyRole` used to live in
  // session.ts, which imports next/headers and the database, so the client-side
  // surface could not ask it and compared Role values inline instead. The
  // predicate is now in roles.ts, which a client bundle can import.
  it("the guard's pure half is importable by a client component", () => {
    const roles = readFileSync(join(REPO_ROOT, "lib/auth/roles.ts"), "utf8")
    expect(roles).toMatch(/export function hasAnyRole\b/)

    // roles.ts must stay free of server-only imports, or the client bundle
    // pulls next/headers and the database in with it.
    expect(roles).not.toMatch(/from\s+"next\/(headers|server)"/)
    expect(roles).not.toMatch(/from\s+"\.\.\/\.\.\/db"/)

    // And the definition must live in ONE place — a second copy is a second
    // spelling, which is the defect class itself.
    const defines = (file: string) =>
      /export function hasAnyRole\b/.test(readFileSync(join(REPO_ROOT, file), "utf8"))
    expect(defines("lib/auth/roles.ts")).toBe(true)
    expect(defines("lib/auth/session.ts")).toBe(false)
  })
})

/**
 * The rule must fail when it should. A check that only ever prints « clean » is
 * indistinguishable from a broken one, so each defect is injected and the
 * decision functions are run against the injected source. They are factored
 * out of the tests above precisely so this is possible without touching the
 * working tree.
 */
describe("the wiring check fails when it should", () => {
  it("catches a NEW administration surface that names Roles", () => {
    // What a #284-style surface looked like before the fix: a single Role.
    const defect = `
      import { requireRole } from "@/lib/auth/server"
      export const POST = async () => {
        const authorized = requireRole(auth, "FINANCE_ADMIN")
        if (!authorized.ok) return authorized.response
      }
    `
    expect(decidesAccess(defect)).toBe(true)
    expect(isAccountedFor("app/api/nouvelle-surface/route.ts", defect)).toBe(false)
  })

  it("catches a surface that stopped asking the set", () => {
    const defect = `
      import { requireRole } from "@/lib/auth/server"
      export const PATCH = async () => requireRole(auth, "FINANCE_ADMIN")
    `
    expect(asksTheSet(defect)).toBe(false)
    // Still accounted for by list membership — the FORWARD direction is what
    // catches a known surface going quiet, which is why both run.
    expect(isAccountedFor("app/api/societe/route.ts", defect)).toBe(true)
  })

  it("catches the inline Role comparison this ticket deleted", () => {
    // The exact shape that lived in the Demandes list page: the page is a
    // known hybrid, so the forward direction must catch the re-derivation.
    const defect = `
      const canExportCsv = role === "FINANCE_ADMIN" || role === "GENERAL_DIRECTION"
    `
    expect(asksTheSet(defect)).toBe(false)
    for (const role of ["FINANCE_ADMIN", "GENERAL_DIRECTION"]) {
      expect(defect, role).toMatch(new RegExp(`["'\`]${role}["'\`]`))
    }
  })

  it("catches a Role named in an administration surface's code", () => {
    const defect = `
      import { requireAnyRole, ROLES_MANAGEMENT } from "@/lib/auth/server"
      export const GET = async () => {
        if (!requireAnyRole(user, ROLES_MANAGEMENT).ok) return null
        return new Response("FINANCE_ADMIN")
      }
    `
    expect(asksTheSet(defect)).toBe(true)
    // Asking the set is not enough if the file also names a Role beside it.
    expect(code(defect).match(ROLE_LITERAL_G)).toEqual(['"FINANCE_ADMIN"'])
  })

  it("passes the real surfaces", () => {
    for (const surface of ADMINISTRATION_SURFACES) {
      const source = readSurface(surface)
      expect(asksTheSet(source), surface).toBe(true)
      expect(isAccountedFor(surface, source), surface).toBe(true)
    }
  })

  it("passes an accounted-for pipeline lane", () => {
    const lane = "app/api/demandes/route.ts"
    const source = readSurface(lane)
    expect(decidesAccess(source)).toBe(true)
    expect(isAccountedFor(lane, source)).toBe(true)
  })

  it("passes the role picker, which grants nothing", () => {
    const picker = "app/(dashboard)/administration/utilisateurs/page.tsx"
    const source = readSurface(picker)
    expect(decidesAccess(source)).toBe(true)
    expect(isAccountedFor(picker, source)).toBe(true)
  })

  it("passes a file that makes no access decision", () => {
    expect(isAccountedFor("components/page-header.tsx", "export const X = 1")).toBe(
      true,
    )
  })

  it("ignores a Role named in a comment", () => {
    const withComment = `
      // A Direction Générale is a GENERAL_DIRECTION, and an employee is an
      // EMPLOYEE — the picker defaults to the latter.
      export const defaultRole = "EMPLOYEE"
    `
    expect(
      code(withComment).match(ROLE_LITERAL_G),
      "the comment is stripped, the real default is not",
    ).toEqual(['"EMPLOYEE"'])
  })
})

/** The set itself, so the hybrid rule above is checked against the real one. */
function ROLES_MANAGEMENT_FOR_TEST(): readonly string[] {
  const roles = readFileSync(join(REPO_ROOT, "lib/auth/roles.ts"), "utf8")
  const block = roles.match(
    /ROLES_MANAGEMENT:\s*readonly Role\[\]\s*=\s*\[([^\]]*)\]/,
  )
  if (!block) throw new Error("ROLES_MANAGEMENT not declared in lib/auth/roles.ts")
  return [...block[1].matchAll(/["'`]([A-Z_]+)["'`]/g)].map((m) => m[1])
}
const ROLES_MANAGEMENT = ROLES_MANAGEMENT_FOR_TEST()
