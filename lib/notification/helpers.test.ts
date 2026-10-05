/**
 * #315 — the recipient resolver asks the Utilisateur module for the activity
 * rule instead of spelling it.
 *
 * This is the Notification half of the ticket, and it is asserted as a SET,
 * not as a string: « only active Utilisateurs are notified » is a claim about
 * which rows come back, so a grep for the column would prove nothing about it.
 * The seed below is deliberately mixed — active and inactive Utilisateurs in
 * the same role and the same Departement — because a suite seeded only with
 * active Utilisateurs passes whether or not the rule is applied at all.
 *
 * `tx` is positional with no default, so a real handle is passed: the
 * conditions are only meaningful as SQL, and a mock query builder would let a
 * wrong condition through.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { resolveRecipients } from "./helpers"
import type { NotificationPayload } from "../notification-events"
import type { Role } from "../auth/roles"

const TIMEOUT = 30_000

/**
 * The source-reading pins below resolve the repo root from this file rather
 * than from `process.cwd()`: vitest's root and the file's own directory are
 * the same thing only by accident of where the run was started from.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..")

interface Seeded {
  role: Role
  departementId: string
  actif: boolean
}

describe("resolveRecipients — the activity rule comes from the Utilisateur reader", {
  timeout: TIMEOUT,
}, () => {
  let pgliteDb: PgliteDb
  let societeId: string
  let rhId: string
  let marketingId: string
  // The mixed set: two MANAGERs in the employee's own Departement, one active
  // and one not, plus an active one elsewhere so « department scoped » and
  // « active » stay two independent axes.
  let managerActif: string
  let managerInactif: string
  let managerActifAutreDept: string
  let financeActif: string
  let financeInactif: string
  let employeActif: string
  let employeInactif: string
  // The Assignataire's pair. They are seeded with Role EMPLOYEE on purpose, and
  // the reason is arithmetic rather than domain: `EVENT_ROLE_MAP` targets
  // MANAGER, FINANCE_ADMIN and GENERAL_DIRECTION and nothing else, so an
  // assignee seeded in any of those Roles would be an extra recipient of some
  // other event in this file and the assertions above would be reading two
  // rules at once. The resolver treats `assigneAId` as the opaque identifier
  // it is — the Assignataire's Role decides no part of `DEMANDE_RETIREE`,
  // which has no role targets — so the Role is chosen to keep the seed from
  // reaching outside this case.
  let assigneActif: string
  let assigneInactif: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)

    societeId = crypto.randomUUID()
    rhId = crypto.randomUUID()
    marketingId = crypto.randomUUID()
    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values([
      { id: rhId, nom: "RH", societeId },
      { id: marketingId, nom: "Marketing", societeId },
    ])

    const seeded: Seeded[] = [
      { role: "MANAGER", departementId: rhId, actif: true },
      { role: "MANAGER", departementId: rhId, actif: false },
      { role: "MANAGER", departementId: marketingId, actif: true },
      { role: "FINANCE_ADMIN", departementId: rhId, actif: true },
      { role: "FINANCE_ADMIN", departementId: marketingId, actif: false },
      { role: "EMPLOYEE", departementId: rhId, actif: true },
      // The employee and the assignee, each seeded TWICE — once active and once
      // not, with the same Role and the same Departement. #355 exists because
      // the employee/assignee additions asked no question at all, so the two
      // ids below are the only ones that can tell « named by the payload »
      // from « named by the payload AND still active ». A suite holding one
      // employee cannot tell those apart at all.
      { role: "EMPLOYEE", departementId: rhId, actif: false },
      { role: "EMPLOYEE", departementId: rhId, actif: true },
      { role: "EMPLOYEE", departementId: rhId, actif: false },
    ]

    const ids = new Map<Seeded, string>()
    await pgliteDb.insert(schema.utilisateurs).values(
      seeded.map((row) => {
        const id = crypto.randomUUID()
        ids.set(row, id)
        return {
          id,
          email: `${id}@acme.ma`,
          nom: "Dupont",
          prenom: "Jean",
          poste: "Dev",
          role: row.role,
          departementId: row.departementId,
          societeId,
          actif: row.actif,
          creeLe: new Date("2026-01-01"),
          modifieLe: new Date("2026-01-01"),
        }
      })
    )

    const idOf = (index: number): string =>
      ids.get(seeded[index] as Seeded) as string
    managerActif = idOf(0)
    managerInactif = idOf(1)
    managerActifAutreDept = idOf(2)
    financeActif = idOf(3)
    financeInactif = idOf(4)
    employeActif = idOf(5)
    employeInactif = idOf(6)
    assigneActif = idOf(7)
    assigneInactif = idOf(8)
  })

  const payload = (overrides?: Partial<NotificationPayload>) =>
    ({
      demandeId: "d-1",
      numero: "DD-2026-0001",
      employe: {
        id: employeActif,
        prenom: "Jean",
        nom: "Dupont",
        departementId: rhId,
      },
      ...overrides,
    }) as NotificationPayload

  // The set assertion the ticket asks for. Before #315 the resolver spelled
  // `eq(utilisateurs.actif, true)`; the seeded inactive MANAGER is what makes
  // that spelling observable, so this is the test that goes RED if the rule is
  // dropped, widened, or written a third time with different semantics.
  it("resolves a mixed active-and-inactive set to the active Utilisateurs only", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_SOUMISE",
      payload(),
      pgliteDb as any
    )

    expect([...recipients].sort()).toEqual([managerActif])
    expect(recipients).not.toContain(managerInactif)
    // Department scoping is unchanged and independent of activity.
    expect(recipients).not.toContain(managerActifAutreDept)
  })

  it("applies the activity rule to an unscoped role too", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_APPROBATION_MANAGER",
      payload(),
      pgliteDb as any
    )

    expect([...recipients].sort()).toEqual([financeActif])
    expect(recipients).not.toContain(financeInactif)
  })

  /**
   * #355 — the event's OWN additions are held to the same rule as the role
   * targets.
   *
   * This case is the rewrite of #315's « still adds the employee and the
   * assignee regardless of activity », and it is a rewrite rather than a
   * deletion because that narrower intent was SETTLED, deliberately, by #315
   * and is now superseded by a decision rather than by an accident. What
   * #315 protected was the activity rule for ROLE TARGETS; what it left alone
   * was the two additions, and the reason it is now decided the other way is
   * that for `DEMANDE_APPROBATION_FINALE` and `DEMANDE_REJETEE` those two
   * additions ARE the whole notification surface: `EVENT_ROLE_MAP` is empty for
   * both events, so « only active Utilisateurs are notified » was true of no
   * path at all for the two events where a Utilisateur most needs to hear
   * that their own DemandeDeplacement was decided.
   *
   * Both halves of each pair are seeded — the active and the inactive employee,
   * the active and the inactive assignee — so the positive assertion is a rule
   * at work rather than an accident of the ids the payload happened to name.
   */
  it("drops an inactive employee and an inactive assignee from the event's own additions", async () => {
    const approbation = await resolveRecipients(
      "DEMANDE_APPROBATION_FINALE",
      payload({ employe: { ...payload().employe, id: employeInactif } }),
      pgliteDb as any
    )
    expect(approbation).toEqual([])

    const retired = await resolveRecipients(
      "DEMANDE_RETIREE",
      payload({ assigneAId: assigneInactif }),
      pgliteDb as any
    )
    expect(retired).toEqual([])
  })

  /**
   * The positive half, and the one that keeps the case above from passing
   * vacuously. An empty recipient set is a legitimate answer to an inactive
   * reader, so the assertion that matters is the PAIR: the same payload, one
   * Utilisateur apart in `actif`, resolves to that Utilisateur and to nobody.
   * This is the same two-axes argument the role-target cases above make, and it
   * is the only thing that distinguishes « filtered by activity » from « this
   * event notifies nobody ever ».
   */
  it("keeps the employee and the assignee when they are active", async () => {
    const approbation = await resolveRecipients(
      "DEMANDE_APPROBATION_FINALE",
      payload({ employe: { ...payload().employe, id: employeActif } }),
      pgliteDb as any
    )
    expect(approbation).toEqual([employeActif])

    const retired = await resolveRecipients(
      "DEMANDE_RETIREE",
      payload({ assigneAId: assigneActif }),
      pgliteDb as any
    )
    expect(retired).toEqual([assigneActif])
  })

  /**
   * A payload naming BOTH an active and an inactive Utilisateur, resolved to
   * one set: the active employee is admitted and nothing else is. Asserted as a
   * SET, because the resolver returns one and a set assertion is the only one
   * that cannot pass by ordering.
   *
   * What this case does NOT prove, which an earlier draft of this comment
   * claimed it did: that the two additions are exercised together, or combined
   * with a role target. `EMPLOYEE_EVENTS` and `ASSIGNEE_EVENTS` are DISJOINT
   * and `EVENT_ROLE_MAP` is empty for `DEMANDE_APPROBATION_FINALE`, so this one
   * call consults the employee addition only and the `assigneAId` below is
   * never read by the resolver at all.
   *
   * The assertion that survives that is the weaker, still-real one: an
   * identifier the payload names does not reach the set without passing the
   * activity rule, and the inactive id sitting beside the active one stays out
   * of it. The weight of this rule is carried by the two cases above, which ask
   * about a named Utilisateur ONE AT A TIME — active against inactive — and only
   * that pair can tell « filtered by activity » from « this event notifies
   * nobody ever ».
   */
  it("keeps an active addition and drops an inactive one in the same set", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_APPROBATION_FINALE",
      payload({
        employe: { ...payload().employe, id: employeActif },
        assigneAId: assigneInactif,
      }),
      pgliteDb as any
    )

    expect([...recipients].sort()).toEqual([employeActif])
  })

  /**
   * #311 — the successor to a test the result-type deletion took with it.
   *
   * The old module suite asserted « a department-scoped event with no
   * `departementId` notifies nobody » through a fake that answered whatever
   * the code asked for, and it read the answer off `result.total`. With the
   * result type gone there was no tally to read, and the behaviour had no other
   * home — so it is here, where the rule actually lives and where the answer
   * comes from rows rather than from a stub.
   *
   * The seed above is what makes `[]` a decision rather than an accident: it
   * holds an active MANAGER in `rhId`, so a resolver that simply dropped the
   * `departementId` check would still resolve to somebody and this test would
   * go red. It is one per Departement, not two — the second active MANAGER is in
   * `marketingId`, so the department filter and the activity filter stay two
   * independent axes rather than one entangled condition.
   */
  it("resolves a department-scoped event to nobody when the employee has no departementId", async () => {
    const recipients = await resolveRecipients(
      "DEMANDE_NOTIFICATION_LUE",
      payload({
        employe: { id: employeActif, prenom: "Jean", nom: "Dupont" },
      }),
      pgliteDb as any
    )

    expect(recipients).toEqual([])
  })
})

/**
 * The pin that the resolver takes its activity condition FROM THE READER
 * rather than writing its own.
 *
 * It is a substitution, not a grep: the reader module's `conditionActif` is
 * replaced by one that admits EVERY Utilisateur, and the resolver's answer is
 * asserted to follow. If the resolver spelled its own
 * `eq(utilisateurs.actif, true)`, the substitution would have no effect on it,
 * the inactive MANAGER would stay out of the set, and this test would fail.
 *
 * The substitution is deliberately the OPPOSITE of the real rule (wider, not
 * narrower): a narrower stand-in would only prove the resolver applies
 * something, not that what it applies is the reader's.
 *
 * The describe carries an explicit timeout: it boots its own PGlite inside the
 * test, and a PGlite `create()` under full-suite load does not fit in the 5s
 * default. (The same reason `describe(..., { timeout: TIMEOUT })` appears in
 * the block above.)
 */
describe("resolveRecipients — asks the reader for the activity condition", {
  timeout: TIMEOUT,
}, () => {
  it("follows the condition the reader's module exports", async () => {
    const pgliteDb = await createPgliteDb()
    const societeId = crypto.randomUUID()
    const rhId = crypto.randomUUID()
    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values({
      id: rhId,
      nom: "RH",
      societeId,
    })

    const rows: Array<{ id: string; actif: boolean }> = [true, false].map(
      (actif) => {
        const id = crypto.randomUUID()
        return { id, actif }
      }
    )
    await pgliteDb.insert(schema.utilisateurs).values(
      rows.map((row) => ({
        id: row.id,
        email: `${row.id}@acme.ma`,
        nom: "Dupont",
        prenom: "Jean",
        poste: "Dev",
        role: "MANAGER" as const,
        departementId: rhId,
        societeId,
        actif: row.actif,
        creeLe: new Date("2026-01-01"),
        modifieLe: new Date("2026-01-01"),
      }))
    )
    const inactifId = rows.find((row) => !row.actif)?.id as string

    vi.resetModules()
    vi.doMock("../utilisateur-service", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../utilisateur-service")>()
      return { ...actual, conditionActif: sql`true` }
    })
    try {
      const { resolveRecipients: substituted } = await import("./helpers")
      const recipients = await substituted(
        "DEMANDE_SOUMISE",
        {
          demandeId: "d-1",
          numero: "DD-2026-0001",
          employe: {
            id: "emp-1",
            prenom: "Jean",
            nom: "Dupont",
            departementId: rhId,
          },
        } as NotificationPayload,
        pgliteDb as any
      )

      // With the reader's condition admitting everyone, the inactive MANAGER is
      // a recipient. The resolver's own spelling, if it had one, would keep it
      // out and fail this line.
      expect(recipients).toContain(inactifId)
      expect(recipients).toHaveLength(2)

      // The same substitution, asked about the two ADDITIONS (#355). This is
      // the half of the rule the role-target line above cannot reach: the
      // inactive employee and the inactive assignee come from the payload, not
      // from a role query, so a resolver that composed the reader's condition
      // into its `WHERE` and then added those two ids outright would still
      // pass the assertion above.
      const additions = await substituted(
        "DEMANDE_APPROBATION_FINALE",
        {
          demandeId: "d-1",
          numero: "DD-2026-0001",
          employe: {
            id: inactifId,
            prenom: "Jean",
            nom: "Dupont",
            departementId: rhId,
          },
        } as NotificationPayload,
        pgliteDb as any
      )
      expect(additions).toEqual([inactifId])

      const assignee = await substituted(
        "DEMANDE_RETIREE",
        {
          demandeId: "d-1",
          numero: "DD-2026-0001",
          employe: {
            id: "emp-1",
            prenom: "Jean",
            nom: "Dupont",
            departementId: rhId,
          },
          assigneAId: inactifId,
        } as NotificationPayload,
        pgliteDb as any
      )
      expect(assignee).toEqual([inactifId])
    } finally {
      vi.doUnmock("../utilisateur-service")
      vi.resetModules()
    }
  })

  /**
   * #356's half of the same pin: `markAsRead` asks the reader's condition too,
   * and it asks it through the SAME export.
   *
   * The substitution is again deliberately the opposite of the real rule — the
   * stand-in admits every Utilisateur — so an inactive reader becomes one this
   * entry may read for, and the read receipt really is dispatched. If
   * `markAsRead` spelled its own `actif` predicate, or checked a role or a
   * flag instead of the rule, the refusal this test inverts would never fire
   * and the row would stay unread.
   *
   * It imports `./index` rather than `./helpers` because `markAsRead` lives in
   * the module's entry file — the point being pinned is that the read path
   * takes its rule from the Utilisateur reader too, which is a claim about a
   * file the resolver case above never loads.
   */
  it("markAsRead follows the condition the reader's module exports", async () => {
    const pgliteDb = await createPgliteDb()
    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "RH",
      societeId,
    })

    const employe = crypto.randomUUID()
    const manager = crypto.randomUUID()
    await pgliteDb.insert(schema.utilisateurs).values(
      [
        { id: employe, nom: "Roux", prenom: "Rena", actif: false },
        { id: manager, nom: "Petit", prenom: "Lucie", actif: true },
      ].map((row) => ({
        ...row,
        email: `${row.id}@acme.ma`,
        poste: "Dev",
        role: row.id === employe ? ("EMPLOYEE" as const) : ("MANAGER" as const),
        departementId,
        societeId,
        creeLe: new Date("2026-01-01"),
        modifieLe: new Date("2026-01-01"),
      }))
    )

    const notificationId = crypto.randomUUID()
    await pgliteDb.insert(schema.notifications).values({
      id: notificationId,
      utilisateurId: employe,
      demandeId: null,
      titre: "Nouvelle demande de déplacement",
      message: "Rena Roux a soumis une demande de déplacement.",
      lu: false,
    })

    vi.resetModules()
    vi.doMock("../utilisateur-service", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../utilisateur-service")>()
      return { ...actual, conditionActif: sql`true` }
    })
    try {
      const { markAsRead: substituted } = await import("./index")
      // No `await expect(...).rejects`: under the stand-in there is nothing to
      // reject, and a case written as a refusal would then be passing for the
      // wrong reason.
      await substituted(notificationId, employe, pgliteDb as any)

      const [row] = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.id, notificationId))
      expect(row?.lu).toBe(true)
    } finally {
      vi.doUnmock("../utilisateur-service")
      vi.resetModules()
    }
  })
})

/**
 * The rule is written ONCE, in the Utilisateur module — the half of the
 * decision that is not about behaviour at all.
 *
 * The substitution above proves the two entries ASK the reader's export. This
 * proves they do not also carry their own copy, which is the failure mode the
 * substitution cannot see: a second spelling that happens to agree today and
 * disagrees the day the rule changes.
 *
 * It reads source rather than importing, because the thing being forbidden is
 * a literal — no value at runtime can distinguish « composed the fragment »
 * from « wrote the same predicate again ». The forbidden spelling is a
 * reference to the COLUMN (`utilisateurs.actif`), which is what any second
 * spelling must go through whatever it wraps the reference in, and it is
 * matched case-sensitively so the exported name `conditionActif` — which ends
 * in the same four letters — is not mistaken for the thing being forbidden.
 *
 * The slice guards are not decoration. A search returns `-1` on a miss, and a
 * slice taken from `-1` is empty or short — so a `not.toContain` on it would
 * pass on a file that had been renamed out from under the check. Asserting the
 * index first is what makes the negative claim mean something.
 */
describe("the activity rule is written once, in the Utilisateur module", () => {
  const readSource = (relative: string) =>
    readFileSync(join(REPO_ROOT, relative), "utf8")

  // Strip comments, so a docblock that NAMES the forbidden literal (several
  // do — they quote it while saying it must not be written) is not mistaken
  // for the module writing it. What remains is executable code.
  const codeOf = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")

  it("neither notification module names the column itself", () => {
    for (const relative of [
      "lib/notification/helpers.ts",
      "lib/notification/index.ts",
    ]) {
      const body = codeOf(readSource(relative))

      // Guard the guard: a miss would leave an empty slice, and an empty slice
      // contains nothing at all.
      const start = body.indexOf("conditionActif")
      expect(
        start,
        `${relative} must still reference the rule`
      ).toBeGreaterThan(-1)

      const spelling = body.match(/utilisateurs\s*\.\s*actif/)
      expect(spelling, `${relative} spells the rule itself`).toBeNull()
    }
  })

  it("the one spelling is in the Utilisateur module", () => {
    const source = readSource("lib/utilisateur-service.ts")

    // Anchored on the DECLARATION, not on a fixed character count. A window of
    // N characters measured from the name is a magic number: a reformat of the
    // one-line definition moves the literal out of it, and a reformat is not a
    // defect. The anchor is asserted rather than assumed, because a miss would
    // leave a slice that proves nothing.
    const declaration = source.indexOf("export const conditionActif")
    expect(
      declaration,
      "the declaration of conditionActif is gone or has been renamed"
    ).toBeGreaterThan(-1)

    // The window ends at the end of the STATEMENT, tracked by bracket depth so
    // a definition wrapped over several lines stays whole inside it. Whitespace
    // is then collapsed on both sides, so the pin survives the wrap a
    // prettier pass would produce — and it is not weakened by that: what it
    // still refuses is the declaration SHEDDING the spelling, by delegating its
    // body to a function elsewhere in the file, which is the drift this pin is
    // for.
    const lines = source.slice(declaration).split("\n")
    const statement: string[] = []
    let depth = 0
    for (const line of lines) {
      statement.push(line)
      depth += (line.match(/[[({]/g) ?? []).length
      depth -= (line.match(/[\])}]/g) ?? []).length
      if (depth <= 0) break
    }
    const unwrapped = (text: string) => text.replace(/\s+/g, "")
    expect(unwrapped(statement.join("\n"))).toContain(
      unwrapped("eq(utilisateurs.actif, true)")
    )
  })
})
