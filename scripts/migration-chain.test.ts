import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The migrator stage runs `drizzle-kit migrate` on every deploy (#241), and
 * drizzle's migrator applies journal entries in order, aborting on the first
 * statement that fails. The test harness cannot see that failure: it wraps each
 * statement in a bare `catch` precisely so a migration written against a
 * pre-existing table does not break the suite. That same `catch` is why the
 * chain shipped broken — migration 0000 backfills `demandes_deplacement`, which
 * 0001 is the migration that creates, so the first entry failed on every empty
 * database and nothing noticed.
 *
 * These assertions replay the chain the way the migrator does — no swallowing —
 * so a migration that cannot run on a fresh database fails here instead of on a
 * deploy.
 *
 * One PGlite instance is shared by both cases and torn down afterwards. The
 * suite already runs a PGlite per test file; adding two more per case made this
 * file the one that timed out under full-suite load.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

interface JournalEntry {
  idx: number
  tag: string
}

function migrationFiles(): string[] {
  const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(join(REPO_ROOT, "drizzle/meta/_journal.json"), "utf-8")
  )
  return journal.entries
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => `${entry.tag}.sql`)
}

function statementsOf(file: string): string[] {
  return readFileSync(join(REPO_ROOT, "drizzle", file), "utf-8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

let client: PGlite

beforeAll(async () => {
  client = await PGlite.create()
})

afterAll(async () => {
  await client.close()
})

describe("the committed migration chain", () => {
  it("applies cleanly to an empty database, failing loudly on any statement", async () => {
    const failures: string[] = []

    for (const file of migrationFiles()) {
      for (const statement of statementsOf(file)) {
        try {
          await client.exec(statement)
        } catch (err) {
          const reason =
            err instanceof Error ? err.message.split("\n")[0] : String(err)
          failures.push(
            `${file}: ${reason} — ${statement.split("\n")[0].slice(0, 60)}`
          )
        }
      }
    }

    // No `catch {}` here on purpose. The migrator has no way to skip a failed
    // entry, so every statement in the chain has to succeed on its own.
    expect(
      failures,
      `Migrations that cannot run on a fresh database:\n${failures.join("\n")}`
    ).toEqual([])
  })

  it("produces the columns the application reads", async () => {
    // The first case already replayed the chain onto this instance.
    const columns = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'demandes_deplacement'`
    )
    const names = columns.rows.map((r) => r.column_name)

    // The Etape + Decision pair replaced `statut` in 0002; a chain that runs to
    // completion must leave them behind and drop the legacy column.
    expect(names).toContain("etape")
    expect(names).toContain("decision")
    expect(names).not.toContain("statut")
  })
})
