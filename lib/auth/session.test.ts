import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { NextResponse } from "next/server"
import { PGlite } from "@electric-sql/pglite"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import * as schema from "../../db/schema"
import {
  migrationTags,
  loadAndCleanSql,
} from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))

// Only the SESSION is faked, and only because the session itself is not what
// this file decides: `auth.api.getSession` is the authentication library's own
// read, which the spec's Out of Scope leaves alone. `BCRYPT_COST` is re-exported
// by the same factory because `lib/auth/set-password.ts` (reached through the
// reader's module) imports it from here.
//
// What is NOT faked any more is the activity read. #316 removed the mock that
// hand-built a query-builder chain to keep this module's query out of the
// suite — the scaffolding that hid the cost this ticket is about. The reader
// this module now calls lives in another module, so that mock stopped
// intercepting anything regardless; the suite runs the query for real against
// an in-process Postgres, redirected at the module's own `db` binding the way
// #314's test redirects it.
vi.mock("./better-auth", () => ({
  BCRYPT_COST: 12,
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

import {
  requireAuth,
  requireRole,
  requireAnyRole,
  hasAnyRole,
  getAuthUser,
} from "./session"
import type { AuthUser } from "./session"
import { lireRole, type Role } from "./roles"

const TIMEOUT = 30_000

let pgliteDb: PgliteDb
let dbModule: typeof import("../../db")
let societeId: string
let departementId: string
let actifId: string
let inactifId: string

/**
 * The SQL a guarded call actually sends, in order.
 *
 * This is the measurement the module's interface now promises: `getAuthUser`
 * and `requireAuth` each cost one read of the activity column, and a caller
 * reading the module is told so. A promise in a doc comment is not a pin, so
 * the suite counts the reads itself. The reader is Drizzle's own `logger` hook
 * — no query is intercepted, shaped or short-circuited by this; every statement
 * listed below really ran against the in-process Postgres.
 */
let executedQueries: string[] = []

/** The activity read: the one statement that selects `actif` off `utilisateurs`. */
function activityQueriesRunSinceReset(): string[] {
  return executedQueries.filter(
    (q) => q.includes("utilisateurs") && q.includes("actif")
  )
}

function resetQueryLog(): void {
  executedQueries = []
}

async function createCountingPgliteDb(): Promise<PgliteDb> {
  const client = await PGlite.create()
  for (const tag of migrationTags()) {
    for (const stmt of loadAndCleanSql(tag)) {
      try {
        await client.exec(stmt)
      } catch {
        /* skip statements that fail on a fresh database */
      }
    }
  }
  return drizzle(client, {
    schema,
    logger: { logQuery: (query: string) => executedQueries.push(query) },
  })
}

function makeUtilisateur(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@test.com`,
    nom: "Dupont",
    prenom: "Jean",
    poste: "Développeur",
    role: "EMPLOYEE" as const,
    departementId,
    societeId,
    actif: true,
    creeLe: new Date("2025-01-01"),
    modifieLe: new Date("2025-01-01"),
    ...overrides,
  }
}

function sessionUser(id: string = actifId) {
  return {
    id,
    email: "jean@example.com",
    name: "Dupont",
    prenom: "Jean",
    role: "EMPLOYEE",
    departementId: "dep-1",
    poste: "Développeur",
    image: "/avatars/jean.png",
  }
}

// The Role the mapper hands the seam is the union, not a string (#297), so a
// fixture building one by hand names a Role and nothing else.
function makeUser(role: Role): AuthUser {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role,
    departementId: "dep-1",
    departement: "IT",
    poste: "Développeur",
    avatarUrl: null,
  }
}

describe("the session module's guarded calls", { timeout: TIMEOUT }, () => {
  beforeAll(async () => {
    pgliteDb = await createCountingPgliteDb()
    dbModule = await import("../../db")
    // The redirection #314 proved: `peutAgir`'s handle argument defaults to
    // this module's own `db` binding, evaluated on every call, so substituting
    // the binding here sends the session module's activity read to PGlite
    // without the session module knowing it was redirected. If that default
    // were ever captured at import time, the cases below would go red rather
    // than quietly query a database that has no such Utilisateur.
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  beforeEach(async () => {
    mockGetSession.mockReset()

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    actifId = crypto.randomUUID()
    inactifId = crypto.randomUUID()

    await pgliteDb.delete(schema.utilisateurs)
    await pgliteDb.delete(schema.departements)
    await pgliteDb.delete(schema.societes)

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Test Societe",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Test Departement",
      societeId,
    })
    await pgliteDb.insert(schema.utilisateurs).values([
      makeUtilisateur({ id: actifId, actif: true }),
      makeUtilisateur({ id: inactifId, actif: false }),
    ])

    resetQueryLog()
  })

  describe("requireAuth", () => {
    it("returns ok:false with 401 when auth() returns null", async () => {
      mockGetSession.mockResolvedValue(null)

      const result = await requireAuth()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response).toBeInstanceOf(NextResponse)
        expect(result.response.status).toBe(401)
        const body = await result.response.json()
        expect(body.error).toBe("Non autorisé")
      }
    })

    it("returns ok:false when session has no user", async () => {
      mockGetSession.mockResolvedValue({})

      const result = await requireAuth()

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    })

    it("returns 401 when the Utilisateur is deactivated", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(inactifId) })

      const result = await requireAuth()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(401)
        // The same cause, with the same wording, as before this change
        // (ADR-0022): the refusal an inactive Utilisateur gets is not a
        // different one wearing a different message.
        const body = await result.response.json()
        expect(body.error).toBe("Non autorisé")
      }
    })

    it("returns 401 when the Utilisateur row no longer exists", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(crypto.randomUUID()) })

      const result = await requireAuth()

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    })

    it("returns ok:true with the mapped AuthUser when auth succeeds", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(actifId) })

      const result = await requireAuth()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.user).toEqual({
          id: actifId,
          email: "jean@example.com",
          name: "Jean Dupont",
          role: "EMPLOYEE",
          departementId: "dep-1",
          departement: "",
          poste: "Développeur",
          avatarUrl: "/avatars/jean.png",
        })
      }
    })
  })

  describe("getAuthUser", () => {
    it("returns null when auth() returns null", async () => {
      mockGetSession.mockResolvedValue(null)

      const result = await getAuthUser()
      expect(result).toBeNull()
    })

    it("returns null when session has no user", async () => {
      mockGetSession.mockResolvedValue({})

      const result = await getAuthUser()
      expect(result).toBeNull()
    })

    it("returns null when the Utilisateur is deactivated", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(inactifId) })

      const result = await getAuthUser()
      expect(result).toBeNull()
    })

    it("returns AuthUser when session has user", async () => {
      const curieId = crypto.randomUUID()
      await pgliteDb.insert(schema.utilisateurs).values(
        makeUtilisateur({ id: curieId, actif: true })
      )
      mockGetSession.mockResolvedValue({
        user: {
          id: curieId,
          email: "marie@example.com",
          name: "Curie",
          prenom: "Marie",
          role: "MANAGER",
          departementId: "dep-2",
          poste: "Chef de projet",
          image: null,
        },
      })

      const result = await getAuthUser()
      expect(result).not.toBeNull()
      expect(result).toEqual({
        id: curieId,
        email: "marie@example.com",
        name: "Marie Curie",
        role: "MANAGER",
        departementId: "dep-2",
        departement: "",
        poste: "Chef de projet",
        avatarUrl: null,
      })
    })
  })

  // THE SEAM REFUSES (#297) — end to end, against a real in-process Postgres.
  //
  // The Utilisateur below is ACTIVE and their row EXISTS: the only thing
  // unusual is the Role stored on the session, which is outside the vocabulary.
  // So a `null` here cannot be explained by deactivation, by a missing row, or
  // by the session read — which is exactly why this case had to be written
  // against the real query path rather than by asserting on the mapper alone.
  //
  // What changed for such a Utilisateur: before #297 they were signed in with
  // the raw string as their Role and the pages swallowed it in a redirect loop;
  // now they are refused once, at the door, with the same `null` an inactive
  // Utilisateur produces.
  describe("the seam refuses a stored Role outside the vocabulary", () => {
    const UNNAMED_ROLES = ["NOT_A_ROLE", "ADMINISTRATEUR", "finance_admin"]

    for (const stored of UNNAMED_ROLES) {
      it(`getAuthUser returns null for ${stored}, and requireAuth 401s`, async () => {
        expect(lireRole(stored), `${stored} must be refused by the reader`).toBeNull()

        mockGetSession.mockResolvedValue({
          user: { ...sessionUser(actifId), role: stored },
        })

        expect(await getAuthUser(), stored).toBeNull()

        const guarded = await requireAuth()
        expect(guarded.ok).toBe(false)
        if (!guarded.ok) {
          // The SAME refusal an inactive Utilisateur receives — same status,
          // same French wording. A refused Role is not a 403 « Accès refusé »:
          // the identity is perfectly good, there is simply no such Utilisateur.
          expect(guarded.response.status).toBe(401)
          const body = await guarded.response.json()
          expect(body.error).toBe("Non autorisé")
        }
      })
    }

    // An ABSENT stored role is the likeliest way a real Utilisateur meets this
    // change: `user.role ?? ""` used to hand the pages an empty string, which is
    // itself outside the vocabulary. It is a refusal now, not a default.
    it("refuses an absent stored Role rather than defaulting it", async () => {
      for (const role of [null, undefined, ""]) {
        mockGetSession.mockResolvedValue({
          user: { ...sessionUser(actifId), role },
        })
        expect(await getAuthUser(), String(role)).toBeNull()
      }
    })

    // The refusal must not be a second query. The cost this module's interface
    // promises is one read of the activity column per guarded call, and a
    // Utilisateur refused for their Role is still one read — the Role check
    // reads a field the engine already returned.
    it("costs the same single activity read as any other guarded call", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "NOT_A_ROLE" },
      })
      resetQueryLog()

      expect(await requireAuth()).toMatchObject({ ok: false })

      expect(activityQueriesRunSinceReset()).toHaveLength(1)
      expect(executedQueries).toHaveLength(1)
    })

    // Non-vacuity for the whole block: the SAME Utilisateur, with the same row
    // and the same session, is admitted the moment the Role is one the union
    // names. Without this, "everything is refused" would pass every case above.
    it("admits the very same Utilisateur when the Role is one the union names", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "NOT_A_ROLE" },
      })
      expect(await getAuthUser()).toBeNull()

      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "EMPLOYEE" },
      })
      expect(await getAuthUser()).toMatchObject({ id: actifId, role: "EMPLOYEE" })
    })
  })

  // THE REFUSAL IS LOGGED (spec #294) — the operator's half.
  //
  // The refusal is correct and it is invisible: a mis-provisioned Utilisateur
  // is refused at the door, and before this line nothing said so anywhere. The
  // spec asks for the refusal to be VISIBLE as a refusal rather than as the
  // redirect loop it replaced, and the only thing that makes it visible to an
  // operator is a line in the log to grep.
  //
  // Both halves are asserted on every path that runs below: the line is emitted
  // when the stored Role is outside the vocabulary, and it is NOT emitted when
  // the same Utilisateur's Role is one the union names. The second half is the
  // one that makes the first mean anything — a logger that fired on every
  // guarded call would satisfy "it logs the refusal" and tell an operator
  // nothing at all, because then the line would name every signed-in user in
  // the deployment rather than the mis-provisioned one.
  describe("the refusal for an unnamed stored Role is logged", () => {
    let warn: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    })

    afterEach(() => {
      warn.mockRestore()
    })

    /** The lines this module emitted, as the structured pairs it emitted them. */
    function refusLines(): unknown[][] {
      return warn.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" && call[0].startsWith("[RoleRefus]")
      )
    }

    it("emits one line naming the Utilisateur when the stored Role is unrecognisable", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "NOT_A_ROLE" },
      })

      expect(await getAuthUser()).toBeNull()

      const lines = refusLines()
      expect(lines).toHaveLength(1)
      const [label, detail] = lines[0] as [string, Record<string, unknown>]
      expect(label).toBe("[RoleRefus] Rôle stocké non reconnu")
      // Named, so an operator can find the row and fix the provisioning.
      expect(detail.utilisateur).toBe(actifId)
      expect(detail.email).toBe("jean@example.com")
      // Enough to correlate two Utilisateurs sharing one bad value, and
      // enough to grep — without the value itself, which is untrusted input
      // from a session row. The absence of the raw value is asserted too: a
      // hash and a verbatim echo look identical in a passing run, and only the
      // negative says which one shipped.
      expect(detail.valeur).toMatch(/^[0-9a-f]{12}$/)
      expect(JSON.stringify(detail)).not.toContain("NOT_A_ROLE")
    })

    // The same Utilisateur, the same row, the same session — only the stored
    // Role differs. This is the non-vacuity half.
    it("emits nothing for the very same Utilisateur once the Role is a named one", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "EMPLOYEE" },
      })

      expect(await getAuthUser()).toMatchObject({ id: actifId, role: "EMPLOYEE" })

      expect(refusLines()).toEqual([])
      expect(warn).not.toHaveBeenCalled()
    })

    // A Utilisateur refused for being INACTIVE reaches the same `null` and is
    // not mis-provisioned. Reporting them the same way would point an operator
    // at a Role when the row to fix is `actif`.
    it("emits nothing for a Utilisateur refused for being inactive", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(inactifId), role: "EMPLOYEE" },
      })

      expect(await getAuthUser()).toBeNull()

      expect(refusLines()).toEqual([])
    })

    // One line per refusal, the rule `refusal-log.ts` states: two Utilisateurs
    // with the same bad value are two occurrences to grep, and one line each.
    it("emits one line per refused Utilisateur", async () => {
      for (const stored of ["NOT_A_ROLE", "ADMINISTRATEUR"]) {
        mockGetSession.mockResolvedValue({
          user: { ...sessionUser(actifId), role: stored },
        })
        expect(await getAuthUser()).toBeNull()
      }

      expect(refusLines()).toHaveLength(2)
    })

    // An absent stored Role is the likeliest real case (`user.role ?? ""` used
    // to hand the pages an empty string), and it is named rather than hashed:
    // there is no value to fingerprint, and « absent » is the diagnosis.
    it("names an absent stored Role rather than fingerprinting nothing", async () => {
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: null },
      })

      expect(await getAuthUser()).toBeNull()

      const lines = refusLines()
      expect(lines).toHaveLength(1)
      expect((lines[0] as unknown[])[1]).toMatchObject({
        utilisateur: actifId,
        valeur: "absent",
      })
    })

    // A log sink that throws is not a 500. The refusal is the contract; the
    // line is observability.
    it("still refuses when the log sink throws", async () => {
      warn.mockImplementation(() => {
        throw new Error("sink down")
      })
      mockGetSession.mockResolvedValue({
        user: { ...sessionUser(actifId), role: "NOT_A_ROLE" },
      })

      expect(await getAuthUser()).toBeNull()
      expect(await requireAuth()).toMatchObject({ ok: false })
    })
  })

  // The cost, measured.
  //
  // The module's interface states what a guarded call costs: one read of the
  // activity column. That statement is the deliverable this ticket is really
  // about — before #316 the read existed and the interface implied a guarded
  // call issued no query at all — so it is pinned here rather than left as a
  // claim in a comment. Three cases, because the count is the interface's
  // promise and each of them is a way that promise could quietly change.
  describe("what a guarded call costs", () => {
    it("requireAuth issues exactly one activity read, and no other query", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(actifId) })
      resetQueryLog()

      await requireAuth()

      expect(activityQueriesRunSinceReset()).toHaveLength(1)
      // And the guarded call asks nothing else of the database: the session
      // read is the library's own, which the spec leaves out of scope, so the
      // one statement above is the whole of this module's per-call cost.
      expect(executedQueries).toHaveLength(1)
    })

    it("getAuthUser issues exactly one activity read, and no other query", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(actifId) })
      resetQueryLog()

      await getAuthUser()

      expect(activityQueriesRunSinceReset()).toHaveLength(1)
      expect(executedQueries).toHaveLength(1)
    })

    it("the activity read is a real query, and it is the one the reader runs", async () => {
      mockGetSession.mockResolvedValue({ user: sessionUser(inactifId) })
      resetQueryLog()

      const result = await requireAuth()

      // Proof the three cases above are not passing because the query stopped
      // being exercised: the statement below ran, and the row it read is one
      // this suite inserted into PGlite moments earlier. Flip that row and the
      // answer above changes with it.
      const activityQuery = activityQueriesRunSinceReset()
      expect(activityQuery).toHaveLength(1)
      expect(activityQuery[0]).toMatch(/^select .* from "utilisateurs"/)
      expect(result.ok).toBe(false)

      await pgliteDb
        .update(schema.utilisateurs)
        .set({ actif: true })
        .where(eq(schema.utilisateurs.id, inactifId))
      resetQueryLog()
      expect(await requireAuth()).toMatchObject({ ok: true })
    })

    it("a call with no session issues no query at all", async () => {
      mockGetSession.mockResolvedValue(null)
      resetQueryLog()

      await requireAuth()

      expect(executedQueries).toHaveLength(0)
    })
  })
})

describe("requireRole", () => {
  it("returns ok:true when the user has the required role", () => {
    const result = requireRole(makeUser("FINANCE_ADMIN"), "FINANCE_ADMIN")

    expect(result.ok).toBe(true)
  })

  it("returns ok:false with 403 when the user has a different role", async () => {
    const result = requireRole(makeUser("EMPLOYEE"), "FINANCE_ADMIN")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })

  // The differently-cased role used to be refused HERE, by `requireRole`, on a
  // `user` built by hand with `makeUser("finance_admin")`. It cannot be asked
  // here any more, and that is the point of #297: `AuthUser.role` is `Role`, so
  // the seam can no longer be handed a Utilisateur carrying a Role it has not
  // read — the fixture itself stopped compiling. The refusal did not disappear,
  // it moved UP the seam to the reader, so it is asserted there: in
  // `roles.test.ts` for the reader, and in « the seam refuses » below for the
  // end-to-end outcome. Asserting nothing in its place would have been the
  // weakening; asserting it one layer earlier is not.
})

describe("requireAnyRole", () => {
  it("returns ok:true when the user has one of the required roles", () => {
    const result = requireAnyRole(makeUser("GENERAL_DIRECTION"), [
      "FINANCE_ADMIN",
      "GENERAL_DIRECTION",
    ])

    expect(result.ok).toBe(true)
  })

  it("returns ok:true when the user matches a single required role", () => {
    const result = requireAnyRole(makeUser("FINANCE_ADMIN"), ["FINANCE_ADMIN"])

    expect(result.ok).toBe(true)
  })

  it("returns ok:false with 403 when the user does not match a single required role", async () => {
    const result = requireAnyRole(makeUser("EMPLOYEE"), ["FINANCE_ADMIN"])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })

  it("returns ok:false with 403 when the required roles list is empty", async () => {
    const result = requireAnyRole(makeUser("FINANCE_ADMIN"), [])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })

  it("returns ok:false with 403 when the user has none of the required roles", async () => {
    const result = requireAnyRole(makeUser("EMPLOYEE"), [
      "FINANCE_ADMIN",
      "GENERAL_DIRECTION",
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })
})

describe("hasAnyRole", () => {
  it("returns true when the role matches a single allowed role", () => {
    expect(hasAnyRole("FINANCE_ADMIN", ["FINANCE_ADMIN"])).toBe(true)
  })

  it("returns true when the role matches one of multiple allowed roles", () => {
    expect(
      hasAnyRole("GENERAL_DIRECTION", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])
    ).toBe(true)
  })

  it("returns false when the role does not match any allowed role", () => {
    expect(hasAnyRole("EMPLOYEE", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])).toBe(
      false
    )
  })

  it("returns false when the allowed list is empty", () => {
    expect(hasAnyRole("FINANCE_ADMIN", [])).toBe(false)
  })
})

describe("seam surface", () => {
  it("exports the Better Auth instance and no next-auth re-exports", async () => {
    const mod = (await import("./session")) as unknown as Record<
      string,
      unknown
    >
    expect(mod.auth).toBeDefined()
    for (const name of [
      "handlers",
      "GET",
      "POST",
      "signIn",
      "signOut",
      "authConfig",
    ]) {
      expect(mod[name]).toBeUndefined()
    }
  })
})
