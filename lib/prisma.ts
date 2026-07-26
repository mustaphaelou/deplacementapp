import { db, type DrizzleDb } from "../db"

export type { DrizzleDb }
export type DrizzleTransactionClient = DrizzleDb

export { db as prisma }
export { db }
