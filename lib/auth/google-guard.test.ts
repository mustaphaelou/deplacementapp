/**
 * #315 — the Google sign-in gate asks the Utilisateur reader whether the
 * Utilisateur may act, instead of reading the activity column off the row it
 * already holds.
 *
 * The pin is a CONTRADICTION, not a restatement. The reader's answer is
 * substituted so that it disagrees with the row the gate selected — twice, in
 * both directions — and the gate's refusal is asserted to follow the READER
 * each time. A gate still reading `utilisateur.actif` off its own row answers
 * the opposite in both cases, so both assertions go RED on it. A test that
 * merely seeded an inactive Utilisateur and saw a refusal would pass on the
 * old code unchanged: that is the trap this file exists to avoid.
 *
 * The refusal vocabulary is asserted here too, because the two must move
 * together: same cause named, same French sentence, no new code. ADR-0022
 * holds whatever the rule's implementation is.
 *
 * `createGoogleGate` takes its handle as an argument, so the gate is built on
 * the in-process Postgres directly. That also threads the handle through to
 * the reader for the un-substituted cases: the Utilisateurs below exist only
 * in PGlite, so a reader that used the module's own `db` would fail to find
 * them — the second `it` is therefore also the evidence that the handle is
 * passed rather than defaulted.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { createGoogleGate } from "./google-guard"
import type { GoogleGateInput } from "./google-guard"
import {
  GOOGLE_REFUSAL_CODES,
  googleRefusalMessage,
} from "./google-refusals"

const TIMEOUT = 30_000

function googleInput(email: string): GoogleGateInput {
  return {
    user: { email },
    source: { oauth: { providerId: "google" } },
  } as unknown as GoogleGateInput
}

describe("createGoogleGate — the activity answer comes from the Utilisateur reader", {
  timeout: TIMEOUT,
}, () => {
  let pgliteDb: PgliteDb
  let societeId: string
  let departementId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
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
  })

  async function seedUtilisateur({
    email,
    actif,
    googleAuthEnabled = true,
  }: {
    email: string
    actif: boolean
    googleAuthEnabled?: boolean
  }): Promise<string> {
    const id = crypto.randomUUID()
    await pgliteDb.insert(schema.utilisateurs).values({
      id,
      email,
      emailVerified: true,
      actif,
      googleAuthEnabled,
      nom: "Dupont",
      prenom: "Jean",
      poste: "Dev",
      role: "EMPLOYEE",
      departementId,
      societeId,
      creeLe: new Date("2026-01-01"),
      modifieLe: new Date("2026-01-01"),
    })
    return id
  }

  // The un-substituted reader, against the gate's own handle. This is the
  // behaviour-preservation half: same admissions, same refusals, same words.
  it("refuses an inactive Utilisateur with the same code and message as before", async () => {
    await seedUtilisateur({ email: "bob@acme.ma", actif: false })
    const gate = createGoogleGate(pgliteDb as any)

    const result = await gate(googleInput("bob@acme.ma"))

    expect(result).toEqual({
      error: GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE,
      errorDescription: googleRefusalMessage(
        GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE
      ),
    })
    // The French sentence is pinned literally as well as through the vocabulary
    // module, so consolidating the rule cannot quietly reword what a Utilisateur
    // is shown.
    expect(result?.errorDescription).toBe(
      "Votre compte est désactivé. Contactez votre administrateur."
    )
  })

  it("admits an active Utilisateur and still refuses the other causes unchanged", async () => {
    const actifId = await seedUtilisateur({
      email: "alice@acme.ma",
      actif: true,
    })
    await seedUtilisateur({
      email: "carol@acme.ma",
      actif: true,
      googleAuthEnabled: false,
    })
    const gate = createGoogleGate(pgliteDb as any)

    expect(await gate(googleInput("alice@acme.ma"))).toBeUndefined()
    expect(actifId).toBeTruthy()

    expect(await gate(googleInput("carol@acme.ma"))).toEqual({
      error: GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE,
      errorDescription: googleRefusalMessage(
        GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE
      ),
    })
    expect(await gate(googleInput("stranger@acme.ma"))).toEqual({
      error: GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE,
      errorDescription: googleRefusalMessage(
        GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE
      ),
    })
  })

  // A non-Google source never reaches the activity question, and never the
  // reader: the gate is a Google-identity gate.
  it("ignores a non-Google source without consulting the reader", async () => {
    const gate = createGoogleGate(pgliteDb as any)
    const result = await gate({
      user: { email: "alice@acme.ma" },
      source: { oauth: { providerId: "github" } },
    } as unknown as GoogleGateInput)
    expect(result).toBeUndefined()
  })
})

/**
 * The contradiction pins. Each case substitutes the reader's answer so that it
 * DISAGREES with the column the gate's own query returns; the gate's verdict
 * must follow the READER.
 *
 * If the gate reads `utilisateur.actif` off its row, both cases below answer
 * the opposite of what is asserted and this file goes RED. Nothing else in the
 * suite can tell the two apart, which is why these two exist.
 *
 * One PGlite for the whole block, shared through `beforeAll`: a PGlite per test
 * costs a boot each, and this file already boots one above. The three
 * Utilisateurs are seeded once and selected by e-mail, so the three cases stay
 * independent without three databases.
 */
describe("createGoogleGate — the verdict follows the reader, not the column", {
  timeout: TIMEOUT,
}, () => {
  let pgliteDb: PgliteDb
  let seeded: Record<string, string>

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
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

    // `actif` here is the COLUMN value the gate's own query would read; the
    // substituted reader's answer is what disagrees with it below.
    const rows = [
      { email: "dave@acme.ma", actif: true },
      { email: "erin@acme.ma", actif: false },
      { email: "frank@acme.ma", actif: true },
    ]
    seeded = {}
    for (const row of rows) {
      const id = crypto.randomUUID()
      seeded[row.email] = id
      await pgliteDb.insert(schema.utilisateurs).values({
        id,
        email: row.email,
        emailVerified: true,
        actif: row.actif,
        googleAuthEnabled: true,
        nom: "Dupont",
        prenom: "Jean",
        poste: "Dev",
        role: "EMPLOYEE",
        departementId,
        societeId,
        creeLe: new Date("2026-01-01"),
        modifieLe: new Date("2026-01-01"),
      })
    }
  })

  /** Run `body` with the reader's `peutAgir` replaced by a fixed answer. */
  async function withReaderAnswer<T>(
    answer: boolean,
    body: (gate: ReturnType<
      typeof import("./google-guard").createGoogleGate
    >) => Promise<T>
  ): Promise<T> {
    vi.resetModules()
    vi.doMock("../utilisateur-service", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../utilisateur-service")>()
      return { ...actual, peutAgir: vi.fn().mockResolvedValue(answer) }
    })
    try {
      const { createGoogleGate: substituted } = await import("./google-guard")
      return await body(substituted(pgliteDb as any))
    } finally {
      vi.doUnmock("../utilisateur-service")
      vi.resetModules()
    }
  }

  it("refuses an active Utilisateur the reader answers false for", async () => {
    const result = await withReaderAnswer(false, (gate) =>
      gate(googleInput("dave@acme.ma"))
    )

    // The COLUMN says actif: true. The reader says no, and the gate refuses —
    // the same code and the same French sentence it has always used.
    expect(result).toEqual({
      error: GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE,
      errorDescription:
        "Votre compte est désactivé. Contactez votre administrateur.",
    })
  })

  it("admits an inactive Utilisateur the reader answers true for", async () => {
    const result = await withReaderAnswer(true, (gate) =>
      gate(googleInput("erin@acme.ma"))
    )

    // The COLUMN says actif: false. The reader says yes, and the gate admits —
    // which is precisely what the old column read could not do.
    expect(result).toBeUndefined()
  })

  // The reader must be asked ABOUT THE UTILISATEUR THE GATE SELECTED, with the
  // gate's own handle — not about the e-mail, and not through the module's
  // default `db`. A gate that passed the wrong identifier would refuse an
  // active Utilisateur whose e-mail happened to match no row.
  it("asks the reader about the selected Utilisateur, through the gate's handle", async () => {
    const spy = vi.fn().mockResolvedValue(true)
    vi.resetModules()
    vi.doMock("../utilisateur-service", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../utilisateur-service")>()
      return { ...actual, peutAgir: spy }
    })
    try {
      const { createGoogleGate: substituted } = await import("./google-guard")
      const gateDb = pgliteDb as any
      const result = await substituted(gateDb)(googleInput("frank@acme.ma"))

      expect(result).toBeUndefined()
      expect(spy).toHaveBeenCalledTimes(1)
      // The first argument is the Utilisateur the gate selected, the second the
      // handle the gate was built with — the same two facts, asserted so a
      // future refactor cannot quietly swap either.
      expect(spy.mock.calls[0]?.[0]).toBe(seeded["frank@acme.ma"])
      expect(spy.mock.calls[0]?.[1]).toBe(gateDb)
    } finally {
      vi.doUnmock("../utilisateur-service")
      vi.resetModules()
    }
  })
})
