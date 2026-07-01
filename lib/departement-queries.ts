import type { Departement, PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"

export interface DepartementQueriesPort {
  listAll(): Promise<Departement[]>
}

export class DepartementQueries {
  constructor(private db: PrismaClient) {}

  async listAll(): Promise<Departement[]> {
    return this.db.departement.findMany({
      orderBy: { nom: "asc" },
    })
  }
}

export const departementQueries = new DepartementQueries(prisma)
