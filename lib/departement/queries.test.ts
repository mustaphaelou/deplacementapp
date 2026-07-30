import { describe, it, expect, beforeAll } from "vitest"
import * as schema from "../../db/schema"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { listDepartements } from "./queries"

const TIMEOUT = 30_000

describe("departement queries", { timeout: TIMEOUT }, () => {
  describe("with populated table", () => {
    let pgliteDb: PgliteDb

    beforeAll(async () => {
      pgliteDb = await createPgliteDb()
      const societeId = crypto.randomUUID()

      await pgliteDb.insert(schema.societes).values({
        id: societeId,
        nom: "Test Societe",
        modifieLe: new Date(),
      })

      await pgliteDb.insert(schema.departements).values([
        { id: crypto.randomUUID(), nom: "Commercial", societeId },
        { id: crypto.randomUUID(), nom: "Administration", societeId },
        { id: crypto.randomUUID(), nom: "Technique", societeId },
      ])
    })

    it("returns departements ordered by nom ASC", async () => {
      const result = await listDepartements(pgliteDb as any)

      expect(result).toHaveLength(3)
      expect(result[0].nom).toBe("Administration")
      expect(result[1].nom).toBe("Commercial")
      expect(result[2].nom).toBe("Technique")
    })
  })

  describe("with empty table", () => {
    let pgliteDb: PgliteDb

    beforeAll(async () => {
      pgliteDb = await createPgliteDb()
    })

    it("returns empty array", async () => {
      const result = await listDepartements(pgliteDb as any)
      expect(result).toEqual([])
    })
  })
})
