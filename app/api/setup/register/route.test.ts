import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { AmorcageDejaConfigureError } from "@/lib/errors"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

const mockQuitterAmorcage = vi.fn()

vi.mock("@/lib/amorcage", () => ({
  quitterAmorcage: mockQuitterAmorcage,
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
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("POST returns 200 with user on successful quitterAmorcage", async () => {
    const fakeUser = { id: "u1", email: "admin@exemple.ma", prenom: "Sara", nom: "Alaoui", role: "GENERAL_DIRECTION" }
    mockQuitterAmorcage.mockResolvedValueOnce({ user: fakeUser })

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ user: fakeUser })
    expect(mockQuitterAmorcage).toHaveBeenCalledTimes(1)
  })

  it("POST returns 409 when quitterAmorcage throws AmorcageDejaConfigureError", async () => {
    mockQuitterAmorcage.mockRejectedValueOnce(new AmorcageDejaConfigureError())

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Cette instance est déjà configurée")
  })
})
