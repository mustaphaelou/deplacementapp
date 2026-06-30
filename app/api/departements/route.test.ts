import { describe, it, expect, vi, beforeEach } from "vitest"
import { DepartementNotFoundError } from "@/lib/errors"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    departement: {
      findMany: vi.fn(),
    },
  },
}))

describe("departements route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of departements", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.departement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "d-1", nom: "IT" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([{ id: "d-1", nom: "IT" }])
  })

  it("GET returns 404 when the Prisma query throws DepartementNotFoundError", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.departement.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DepartementNotFoundError()
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Departement introuvable")
  })
})
