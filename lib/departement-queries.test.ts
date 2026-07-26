import { describe, it, expect, vi } from "vitest"
import { DepartementQueries } from "./departement-queries"

function mockDb() {
  return {
    query: {
      departements: {
        findMany: vi.fn(),
      },
    },
  }
}

const fakeDepartements = [
  { id: "d-1", nom: "Commercial" },
  { id: "d-2", nom: "Production" },
  { id: "d-3", nom: "Technique" },
]

describe("DepartementQueries", () => {
  it("listAll returns all departements ordered by nom asc", async () => {
    const db = mockDb()
    db.query.departements.findMany.mockResolvedValue(fakeDepartements)

    const queries = new DepartementQueries(db as any)
    const result = await queries.listAll()

    expect(result).toEqual(fakeDepartements)
    expect(db.query.departements.findMany).toHaveBeenCalledWith({
      orderBy: [expect.any(Object)],
    })
  })

  it("listAll returns an empty array when no departements exist", async () => {
    const db = mockDb()
    db.query.departements.findMany.mockResolvedValue([])

    const queries = new DepartementQueries(db as any)
    const result = await queries.listAll()

    expect(result).toEqual([])
  })
})
