import { describe, it, expect, vi } from "vitest"
import { DepartementQueries } from "./departement-queries"
import type { PrismaClient } from "@prisma/client"

interface MockedDb {
  departement: {
    findMany: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    departement: {
      findMany: vi.fn(),
    },
  }
}

const fakeDepartements = [
  { id: "d-1", nom: "Commercial" },
  { id: "d-2", nom: "Production" },
  { id: "d-3", nom: "Technique" },
]

describe("DepartementQueries", () => {
  // ── findAll ──────────────────────────────────────────────────────────

  it("findAll returns all departements ordered by nom asc", async () => {
    const db = mockDb()
    db.departement.findMany.mockResolvedValue(fakeDepartements)

    const queries = new DepartementQueries(db as unknown as PrismaClient)
    const result = await queries.findAll()

    expect(result).toEqual(fakeDepartements)
    expect(db.departement.findMany).toHaveBeenCalledWith({
      orderBy: { nom: "asc" },
    })
  })

  it("findAll returns an empty array when no departements exist", async () => {
    const db = mockDb()
    db.departement.findMany.mockResolvedValue([])

    const queries = new DepartementQueries(db as unknown as PrismaClient)
    const result = await queries.findAll()

    expect(result).toEqual([])
  })
})
