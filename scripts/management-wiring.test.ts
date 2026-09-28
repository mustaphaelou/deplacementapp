import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { ROLES_MANAGEMENT } from "../lib/auth/roles"

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
 *
 * SCOPE, stated honestly: the backward walk covers `app/` only. A
 * administration surface that lands in `lib/` (a server action, a shared
 * route helper) would be invisible to it. Nothing escapes today — the repo
 * has no `"use server"` file and no middleware Role gate — and the surfaces
 * the set governs are all routes and pages. If a server action is ever
 * introduced, widen `appFiles` to cover `lib/` (or add those files to
 * ADMINISTRATION_SURFACES explicitly) in the same change. The claim this file
 * makes is « an omission under app/ is loud », and that is the claim it keeps.
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

/**
 * Strip comments, so a comment explaining the rule may quote a Role name.
 *
 * A single pass that tracks string state, NOT a regex. A regex stripper
 * cannot tell a comment from a `//` that lives inside a string literal, so
 * `requireRole(auth, "https://x/FINANCE_ADMIN")` had the rest of its line —
 * Role included — deleted as if it were a comment, and the surface passed.
 * (Found by live injection.) Here a `//` inside quotes is just a character.
 */
function code(source: string): string {
  let out = ""
  let i = 0
  // Which string delimiter we are inside, or null. `undefined` would be
  // ambiguous with "not in a string" being falsy-checked below.
  let quote: '"' | "'" | "`" | null = null

  while (i < source.length) {
    const char = source[i]!

    if (quote) {
      // A backslash escapes the next character inside a string, so an
      // escaped quote does not close it.
      if (char === "\\") {
        out += source.slice(i, i + 2)
        i += 2
        continue
      }
      if (char === quote) quote = null
      out += char
      i += 1
      continue
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char
      out += char
      i += 1
      continue
    }

    // Line comment.
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1
      continue
    }

    // Block comment.
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2)
      i = end === -1 ? source.length : end + 2
      // Keep the newlines so line-based reporting stays aligned.
      continue
    }

    out += char
    i += 1
  }

  return out
}

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

// Tests `code(source)`, NOT the raw source. A comment that explains the rule
// may name ROLES_MANAGEMENT — and if this read the raw file, a surface could
// satisfy this rule in prose while re-deriving the answer in code, which is
// the exact defect #281 exists to remove. (Found by live injection: replacing
// the Societe guard with a local `peutGerer()` wrapper and leaving the set
// mentioned only in a comment passed every rule in this file.)
const asksTheSet = (source: string): boolean =>
  /\bROLES_MANAGEMENT\b/.test(code(source))

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

  it("catches a Role hidden behind a // inside a string literal", () => {
    // The second live-injection false negative: the regex stripper deleted
    // everything after `//` to end-of-line, so a Role inside a URL string was
    // removed along with the "comment" and the surface passed. A `//` inside
    // quotes is a character, not a comment.
    const defect = `
      export const PATCH = async () => {
        return requireRole(auth, "https://example.test/FINANCE_ADMIN")
      }
    `
    // The Role SURVIVES comment-stripping — that is the whole point. (It does
    // not match ROLE_LITERAL, which wants a standalone quoted token; this rule
    // is about the stripper deleting it, not about a second matcher finding
    // it.)
    expect(code(defect)).toContain("FINANCE_ADMIN")

    // A standalone Role literal after a // in a string is the stronger form,
    // and this is the one the surface rule can act on:
    const standalone = `
      export const PATCH = async () => {
        return requireRole(auth, "https://example.test/" + "FINANCE_ADMIN")
      }
    `
    expect(code(standalone).match(ROLE_LITERAL_G)).toEqual(['"FINANCE_ADMIN"'])
  })

  it("still strips a real comment that mentions a Role", () => {
    const withComment = `
      // Historically this was reserved to FINANCE_ADMIN (see ADR-0012).
      export const PATCH = async () => requireAnyRole(auth, ROLES_MANAGEMENT)
    `
    // match() yields null, not [], when nothing matches.
    expect(code(withComment).match(ROLE_LITERAL_G) ?? []).toEqual([])
    expect(asksTheSet(withComment)).toBe(true)
  })

  it("catches a surface that names the set ONLY in a comment", () => {
    // The live-injection false negative: a local `peutGerer()` wrapper
    // re-derives the answer in code, while a comment above it explains the
    // rule and names the set. Reading the raw file, this passed every rule in
    // this file. It must not.
    const defect = `
      // Access is governed by ROLES_MANAGEMENT (spec #281).
      const peutGerer = (role: string) => role === "FINANCE_ADMIN"
      export const PATCH = async () => {
        if (!peutGerer(user.role)) return null
      }
    `
    expect(decidesAccess(defect)).toBe(true)
    expect(asksTheSet(defect), "a comment must not satisfy the forward rule").toBe(
      false,
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

// Imported, not re-read. An earlier version regex-parsed the declaration out
// of lib/auth/roles.ts as text — a SECOND, textual reading of the set, which
// is the same defect class this spec exists to remove, one level up. The
// literal pin on the set itself lives in lib/auth/roles.test.ts.
