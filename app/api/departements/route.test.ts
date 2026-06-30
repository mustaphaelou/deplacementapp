import { describe, it, expect, vi, beforeEach } from "vitest"

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

  it("GET returns the list of Departement", async () => {
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

  it("GET returns 500 when the Prisma query throws an unknown error", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.departement.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur interne")
  })
})
