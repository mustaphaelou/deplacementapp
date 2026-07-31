import { drizzle } from "drizzle-orm/node-postgres"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { Pool } from "pg"
import * as schema from "./schema"

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>
export type DrizzleTransactionClient = PgDatabase<PgQueryResultHKT, typeof schema>

const globalForDrizzle = globalThis as unknown as { db: DrizzleDb }

function createDb(): DrizzleDb {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return drizzle(pool, { schema })
}

export const db = globalForDrizzle.db ?? createDb()

if (process.env.NODE_ENV !== "production") globalForDrizzle.db = db
