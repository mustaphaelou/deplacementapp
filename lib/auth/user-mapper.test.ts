import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { toAuthUser, type AuthUser } from "./user-mapper"
import type { BetterAuthSessionUser } from "./user-mapper"
import { TOUS_LES_ROLES } from "./roles"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

describe("toAuthUser", () => {
  it("maps a Better Auth session user onto the domain AuthUser shape", () => {
    const sessionUser: BetterAuthSessionUser = {
      id: "user-1",
      email: "jean@example.com",
      name: "Dupont",
      prenom: "Jean",
      role: "EMPLOYEE",
      departementId: "dep-1",
      poste: "Développeur",
      image: "/avatars/jean.png",
    }

    const result = toAuthUser(sessionUser)

    const expected: AuthUser = {
      id: "user-1",
      email: "jean@example.com",
      name: "Jean Dupont",
      role: "EMPLOYEE",
      departementId: "dep-1",
      departement: "",
      poste: "Développeur",
      avatarUrl: "/avatars/jean.png",
    }
    expect(result).toEqual(expected)
  })

  it("keeps the same AuthUser shape for both seam halves", () => {
    const keys = Object.keys(toAuthUser({ role: "EMPLOYEE" })!) as (
      | keyof AuthUser
    )[]
    expect(keys.sort()).toEqual(
      [
        "id",
        "email",
        "name",
        "role",
        "departementId",
        "departement",
        "poste",
        "avatarUrl",
      ].sort()
    )
  })

  it("derives the display name from prenom + nom", () => {
    expect(toAuthUser({ prenom: "Marie", name: "Curie", role: "EMPLOYEE" })!.name).toBe(
      "Marie Curie"
    )
  })

  it("tolerates missing optional fields", () => {
    const result = toAuthUser({ id: "user-2", email: "x@example.com", role: "MANAGER" })
    expect(result).toEqual({
      id: "user-2",
      email: "x@example.com",
      name: "",
      role: "MANAGER",
      departementId: "",
      departement: "",
      poste: "",
      avatarUrl: null,
    })
  })

  // #297's behaviour change, one layer in: the Role no longer survives as a
  // plain string. Every member of the vocabulary comes through as itself, so
  // this is not a mapper that refuses in general.
  it("carries each Role of the union through unchanged", () => {
    for (const role of TOUS_LES_ROLES) {
      expect(toAuthUser({ role })?.role, role).toBe(role)
    }
  })

  // The refusal, at the mapper: a stored Role outside the vocabulary produces
  // no AuthUser at all. Before #297 it produced one carrying the raw string,
  // which is what made the pages redirect between each other and swallow it.
  it("refuses a stored Role outside the vocabulary", () => {
    for (const stored of ["NOT_A_ROLE", "admin", "Employé", "finance_admin"]) {
      expect(toAuthUser({ id: "u", role: stored }), stored).toBeNull()
    }
  })

  // The absent value used to become "" — a string outside the vocabulary, and
  // the single most likely way a real Utilisateur got caught by this change.
  // It is a refusal, and saying so explicitly is the point.
  it("refuses an absent stored Role rather than defaulting it", () => {
    expect(toAuthUser({ id: "u" })).toBeNull()
    expect(toAuthUser({ id: "u", role: null })).toBeNull()
    expect(toAuthUser({ id: "u", role: "" })).toBeNull()
  })

  // A refusal is an answer, not a crash: a throwing mapper would turn a data
  // condition into an exception on a page that today at least renders.
  it("refuses without throwing, whatever the stored value is", () => {
    for (const stored of [undefined, null, "", 0, {}, [], true, "NOT_A_ROLE"]) {
      expect(() => toAuthUser({ id: "u", role: stored as never })).not.toThrow()
      expect(toAuthUser({ id: "u", role: stored as never })).toBeNull()
    }
  })
})

// Both halves of the seam read through the SAME reader. This is an acceptance
// criterion rather than a nicety, and it is structural in one direction only:
// `AuthUser.role` is `Role`, so a half that assembled one any other way could
// not typecheck. What cannot be checked that way is a half that stopped calling
// the mapper at all and took `session.user` straight off the library — so the
// two call sites are pinned by source.
describe("both halves of the seam read through the same reader", () => {
  const SEAM_HALVES = ["lib/auth/session.ts", "lib/auth/client.ts"]

  for (const half of SEAM_HALVES) {
    it(`${half} maps through toAuthUser and reads no library shape directly`, () => {
      const source = readFileSync(join(REPO_ROOT, half), "utf8")
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

      expect(code, half).toMatch(/\btoAuthUser\s*\(/)
      // The Role must not be assigned from the library's own field again, which
      // is what would put an unnarrowed `string` back into the shape.
      expect(code, half).not.toMatch(/\brole\s*:\s*[^,}\n]*\.role\b/)
    })
  }

  // The engine's shape is NOT narrowed: it is the engine's field and it stays
  // `string | null | undefined`, so this file cannot pretend to own it.
  it("leaves the engine's own session field wide", () => {
    const source = readFileSync(
      join(REPO_ROOT, "lib/auth/user-mapper.ts"),
      "utf8"
    )
    expect(source).toMatch(/role\?:\s*string\s*\|\s*null/)
  })

  // The declaration the whole narrowing rests on. `role: Role` on `AuthUser`
  // is what makes the ten casts unnecessary; if it widens back to `string` they
  // would all typecheck again and nothing else in the suite would notice.
  it("declares AuthUser.role as the Role union, not as a string", () => {
    const source = readFileSync(
      join(REPO_ROOT, "lib/auth/user-mapper.ts"),
      "utf8"
    )
    const interfaceBody = source.slice(
      source.indexOf("export interface AuthUser {"),
      source.indexOf("export interface BetterAuthSessionUser")
    )
    // Guard against a vacuous slice: `indexOf` answers -1 for a missing needle,
    // and `slice(a, -1)` would still produce a non-empty string.
    expect(interfaceBody.length).toBeGreaterThan(0)
    expect(interfaceBody).toMatch(/\brole:\s*Role\b/)
    expect(interfaceBody).not.toMatch(/\brole:\s*string\b/)
  })
})