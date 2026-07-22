import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    utilisateur: { count: vi.fn() },
    departement: { findMany: vi.fn() },
  },
}))

describe("setup status route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns needsSetup: true with existing Departement names when zero Utilisateurs exist", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.utilisateur.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(prisma.departement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { nom: "Direction Générale" },
      { nom: "Technique" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(true)
    expect(body.departements).toEqual(["Direction Générale", "Technique"])
  })

  it("GET returns needsSetup: false when at least one Utilisateur exists", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.utilisateur.count as ReturnType<typeof vi.fn>).mockResolvedValue(3)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(false)
    expect(body.departements).toBeUndefined()
  })
})
