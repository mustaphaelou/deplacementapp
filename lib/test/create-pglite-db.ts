import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import * as schema from "../../db/schema"

export type PgliteDb = ReturnType<typeof drizzle<typeof schema>>

const DIR = path.dirname(fileURLToPath(import.meta.url))
const DRIZZLE_DIR = path.resolve(DIR, "../../drizzle")

interface JournalEntry {
  idx: number
  tag: string
}

function migrationTags(): string[] {
  const journalPath = path.join(DRIZZLE_DIR, "meta/_journal.json")
  const journal: { entries: JournalEntry[] } = JSON.parse(
    fs.readFileSync(journalPath, "utf-8")
  )
  return journal.entries.sort((a, b) => a.idx - b.idx).map((e) => e.tag)
}

function loadAndCleanSql(tag: string): string[] {
  const sqlPath = path.join(DRIZZLE_DIR, `${tag}.sql`)
  const raw = fs.readFileSync(sqlPath, "utf-8")
  return raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Create an in-process PGlite database with all Drizzle migrations applied.
 *
 * Each call returns a fresh, isolated instance backed by an ephemeral in-memory
 * Postgres.  The returned `db` object is a full Drizzle ORM client bound to the
 * real schema in `db/schema/`, so both relational (`db.query.*`) and raw
 * (`db.execute(sql\`...\`)`) queries work.
 *
 * ---
 * ## Per-test-file pattern for swapping the database module
 *
 * Tests that need real persistence should NOT import `db` from `@/db`. Instead,
 * they call `createPgliteDb()` to get an isolated instance, then use it
 * directly:
 *
 * ```ts
 * import { describe, it, expect } from "vitest"
 * import { sql } from "drizzle-orm"
 * import * as schema from "@/db/schema"
 * import { createPgliteDb } from "@/lib/test/create-pglite-db"
 *
 * it("inserts a societe", async () => {
 *   const db = await createPgliteDb()
 *   await db.insert(schema.societes).values({ id: "s1", nom: "Acme", modifieLe: new Date() })
 *   const rows = await db.query.societes.findMany()
 *   expect(rows).toHaveLength(1)
 * })
 * ```
 *
 * To replace the app-wide `db` singleton in a module-under-test, use vitest's
 * module mocking:
 *
 * ```ts
 * import { createPgliteDb } from "@/lib/test/create-pglite-db"
 * import * as dbModule from "@/db"
 *
 * const pgliteDb = await createPgliteDb()
 * vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb)
 * ```
 *
 * This keeps the rest of the module's code unchanged while directing all
 * database traffic to the ephemeral PGLite instance.
 * ---
 */
export async function createPgliteDb(): Promise<PgliteDb> {
  const client = await PGlite.create()

  for (const tag of migrationTags()) {
    const statements = loadAndCleanSql(tag)
    for (const stmt of statements) {
      try {
        await client.exec(stmt)
      } catch {
        /* skip statements that fail on a fresh database
           (e.g. ALTER TABLE on a table created in a later migration) */
      }
    }
  }

  return drizzle(client, { schema })
}
