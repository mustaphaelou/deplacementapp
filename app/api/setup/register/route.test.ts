import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

let mockCount = 0
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => [{ value: mockCount }]),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(),
  })),
}

vi.mock("@/db", () => ({
  db: mockDb,
}))

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed$"),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

function mockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/setup/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

const validPayload = {
  societeNom: "Ma Société",
  departements: ["Direction Générale", "Technique"],
  nomExpediteurEmail: "Ma Société",
  admin: {
    email: "admin@exemple.ma",
    password: "motdepasse123",
    nom: "Alaoui",
    prenom: "Sara",
    poste: "Directrice Générale",
    departementNom: "Direction Générale",
  },
}

describe("setup register route", () => {
  beforeEach(async () => {
    mockCount = 0
    vi.clearAllMocks()
    const { hash } = await import("bcryptjs")
    ;(hash as ReturnType<typeof vi.fn>).mockResolvedValue("$hashed$")
  })

  it("POST returns 409 when a Societe already exists", async () => {
    mockCount = 1

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Cette instance est déjà configurée.")
  })

  it("POST returns 400 on invalid email", async () => {
    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        admin: { ...validPayload.admin, email: "pas-un-email" },
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST returns 400 on empty societeNom", async () => {
    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        societeNom: "",
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST creates Societe, departments and the first Utilisateur on valid input", async () => {
    const { hash } = await import("bcryptjs")

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      user: expect.objectContaining({
        email: "admin@exemple.ma",
        prenom: "Sara",
        nom: "Alaoui",
        role: "GENERAL_DIRECTION",
      }),
    })
    expect(hash).toHaveBeenCalledWith("motdepasse123", 12)
  })

  it("POST creates departments for each departement name", async () => {
    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
  })
})
