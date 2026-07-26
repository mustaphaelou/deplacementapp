import { asc } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { departements } from "../db/schema/departements"

export interface DepartementQueriesPort {
  listAll(): Promise<unknown[]>
}

export class DepartementQueries {
  constructor(private _db: DrizzleDb) {}

  async listAll() {
    return this._db.query.departements.findMany({
      orderBy: [asc(departements.nom)],
    })
  }
}

export const departementQueries = new DepartementQueries(db)