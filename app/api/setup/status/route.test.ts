import { describe, it, expect, vi, beforeEach } from "vitest"

const mockEstEnAmorcage = vi.fn()

vi.mock("@/lib/amorcage", () => ({
  estEnAmorcage: mockEstEnAmorcage,
}))

describe("setup status route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET returns needsSetup: true with no departements when no Societe exists", async () => {
    mockEstEnAmorcage.mockResolvedValueOnce(true)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(true)
    expect(body.departements).toEqual([])
  })

  it("GET returns needsSetup: false when at least one Societe exists", async () => {
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(false)
    expect(body.departements).toBeUndefined()
  })
})
