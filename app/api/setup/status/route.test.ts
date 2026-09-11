import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockEstEnAmorcage = vi.fn()

vi.mock("@/lib/amorcage", () => ({
  estEnAmorcage: mockEstEnAmorcage,
}))

describe("setup status route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

  it("reports connexionGoogle: true when both Google credentials are configured", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id.apps.googleusercontent.com")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret")
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.needsSetup).toBe(false)
    expect(body.connexionGoogle).toBe(true)
  })

  it("reports connexionGoogle: false when both credentials are missing", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "")
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const body = await (await GET()).json()

    expect(body.connexionGoogle).toBe(false)
  })

  it("reports connexionGoogle: false when only the id is set", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id.apps.googleusercontent.com")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "")
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const body = await (await GET()).json()

    expect(body.connexionGoogle).toBe(false)
  })

  it("reports connexionGoogle: false when only the secret is set", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret")
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const body = await (await GET()).json()

    expect(body.connexionGoogle).toBe(false)
  })

  it("treats whitespace-only credentials as missing", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "  ")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret")
    mockEstEnAmorcage.mockResolvedValueOnce(false)

    const { GET } = await import("./route")
    const body = await (await GET()).json()

    expect(body.connexionGoogle).toBe(false)
  })
})
