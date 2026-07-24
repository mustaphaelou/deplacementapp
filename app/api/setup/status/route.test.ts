import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    societe: { count: vi.fn() },
  },
}))

describe("setup status route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns needsSetup: true with no departements when no Societe exists", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.societe.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(true)
    expect(body.departements).toEqual([])
  })

  it("GET returns needsSetup: false when at least one Societe exists", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.societe.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(false)
    expect(body.departements).toBeUndefined()
  })
})
