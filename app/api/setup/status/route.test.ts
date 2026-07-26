import { describe, it, expect, vi, beforeEach } from "vitest"

let mockCount = 0
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => [{ value: mockCount }]),
  })),
}

vi.mock("@/db", () => ({
  db: mockDb,
}))

describe("setup status route", () => {
  beforeEach(() => {
    mockCount = 0
    vi.clearAllMocks()
  })

  it("GET returns needsSetup: true with no departements when no Societe exists", async () => {
    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(true)
    expect(body.departements).toEqual([])
  })

  it("GET returns needsSetup: false when at least one Societe exists", async () => {
    mockCount = 1

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(false)
    expect(body.departements).toBeUndefined()
  })
})
