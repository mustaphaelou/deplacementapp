import { asc } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { db } from "../../db"
import { departements } from "../../db/schema/departements"

export async function listDepartements(dbArg: DrizzleDb = db) {
  return dbArg.query.departements.findMany({
    orderBy: [asc(departements.nom)],
  })
}
