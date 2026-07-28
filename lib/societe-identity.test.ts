import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import * as schema from "../db/schema"
import * as dbModule from "../db"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import { loadSocieteIdentity, clearCache } from "./societe-identity"
import type { SocieteIdentity } from "./societe-identity"

const TIMEOUT = 30_000

describe("SocieteIdentity resolver", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM societes`)
    clearCache()
  })

  it("returns SocieteIdentity from DB row", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "s1",
      nom: "Test Inc",
      nomExpediteurEmail: "Test Sender",
      domaineEmail: "test.ma",
      modifieLe: new Date(),
    })

    const identity = await loadSocieteIdentity()
    expect(identity).toEqual<SocieteIdentity>({
      nomExpediteurEmail: "Test Sender",
      domaineEmail: "noreply@test.ma",
    })
  })

  it("is memoized: second call returns cached values without re-querying", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "s2",
      nom: "Memo Inc",
      nomExpediteurEmail: "Memo Sender",
      domaineEmail: "memo.ma",
      modifieLe: new Date(),
    })

    const first = await loadSocieteIdentity()
    expect(first.nomExpediteurEmail).toBe("Memo Sender")
    expect(first.domaineEmail).toBe("noreply@memo.ma")

    await pgliteDb
      .update(schema.societes)
      .set({ nomExpediteurEmail: "Mutated Sender", domaineEmail: "mutated.ma" })
      .where(eq(schema.societes.id, "s2"))

    const second = await loadSocieteIdentity()
    expect(second.nomExpediteurEmail).toBe("Memo Sender")
    expect(second.domaineEmail).toBe("noreply@memo.ma")
  })

  it("returns env fallback when Societe row has null email fields", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "s3",
      nom: "Partial Inc",
      modifieLe: new Date(),
    })

    const identity = await loadSocieteIdentity()
    expect(identity).toEqual<SocieteIdentity>({
      nomExpediteurEmail: "Notification",
      domaineEmail: "noreply@exemple.ma",
    })
  })

  it("returns env fallback when no Societe row exists", async () => {
    const identity = await loadSocieteIdentity()
    expect(identity).toEqual<SocieteIdentity>({
      nomExpediteurEmail: "Notification",
      domaineEmail: "noreply@exemple.ma",
    })
  })

  it("warns once and returns env fallback when DB is unreachable", async () => {
    const throwingDb = {
      select: () => ({
        from: () => ({
          limit: () => {
            throw new Error("connection refused")
          },
        }),
      }),
    } as any

    vi.spyOn(dbModule, "db", "get").mockReturnValue(throwingDb)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    clearCache()

    const identity = await loadSocieteIdentity()
    expect(identity).toEqual<SocieteIdentity>({
      nomExpediteurEmail: "Notification",
      domaineEmail: "noreply@exemple.ma",
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      "[SocieteIdentity] Database unreachable — using SMTP env fallback",
    )

    const identity2 = await loadSocieteIdentity()
    expect(identity2).toEqual(identity)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  it("clearCache forces re-query on next call", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "s4",
      nom: "Cache Test",
      nomExpediteurEmail: "Original Sender",
      domaineEmail: "original.ma",
      modifieLe: new Date(),
    })

    const first = await loadSocieteIdentity()
    expect(first.nomExpediteurEmail).toBe("Original Sender")

    await pgliteDb
      .update(schema.societes)
      .set({ nomExpediteurEmail: "Updated Sender", domaineEmail: "updated.ma" })
      .where(eq(schema.societes.id, "s4"))

    const cached = await loadSocieteIdentity()
    expect(cached.nomExpediteurEmail).toBe("Original Sender")

    clearCache()

    const second = await loadSocieteIdentity()
    expect(second).toEqual<SocieteIdentity>({
      nomExpediteurEmail: "Updated Sender",
      domaineEmail: "noreply@updated.ma",
    })
  })
})
