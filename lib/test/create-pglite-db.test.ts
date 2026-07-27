import { describe, it, expect } from "vitest"
import { sql } from "drizzle-orm"

const TIMEOUT = 30_000
import * as schema from "../../db/schema"
import { createPgliteDb } from "./create-pglite-db"

describe("PGLite test seam", { timeout: TIMEOUT }, () => {
  it("inserts and reads back a societe row", async () => {
    const db = await createPgliteDb()

    await db.insert(schema.societes).values({
      id: "default",
      nom: "Test Societe",
      modifieLe: new Date(),
    })

    const rows = await db.query.societes.findMany({
      orderBy: (s, { asc }) => [asc(s.id)],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].nom).toBe("Test Societe")
    expect(rows[0].id).toBe("default")
  })

  it("each call gets a fresh database", async () => {
    const db1 = await createPgliteDb()
    const db2 = await createPgliteDb()

    await db1.insert(schema.societes).values({
      id: "soc-a",
      nom: "Societe A",
      modifieLe: new Date(),
    })

    const rows1 = await db1.query.societes.findMany()
    const rows2 = await db2.query.societes.findMany()

    expect(rows1).toHaveLength(1)
    expect(rows2).toHaveLength(0)
  })

  it("can query with raw SQL", async () => {
    const db = await createPgliteDb()
    const result = await db.execute(sql`SELECT 1 as val`)
    expect(result.rows[0].val).toBe(1)
  })
})
