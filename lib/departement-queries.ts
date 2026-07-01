import type { Departement, PrismaClient } from "@prisma/client"
import { prisma } from "./prisma"

export interface DepartementQueriesPort {
  findAll(): Promise<Departement[]>
}

export class DepartementQueries {
  constructor(private db: PrismaClient) {}

  async findAll(): Promise<Departement[]> {
    return this.db.departement.findMany({
      orderBy: { nom: "asc" },
    })
  }
}

export const departementQueries = new DepartementQueries(prisma)
