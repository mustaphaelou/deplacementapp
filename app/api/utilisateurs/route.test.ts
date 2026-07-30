import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { UtilisateurNotFoundError } from "@/lib/utilisateur-service"

const { mockRequireAnyRole } = vi.hoisted(() => ({
  mockRequireAnyRole: (user: { role: string }, roles: readonly string[]) => {
    if (roles.includes(user.role)) return { ok: true }
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
      }),
    }
  },
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  requireAnyRole: mockRequireAnyRole,
}))

vi.mock("@/lib/utilisateur-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/utilisateur-service")>()
  return {
    ...actual,
    utilisateurService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
})

function mockRequest(body: unknown, method: string): NextRequest {
  return new NextRequest("http://localhost/api/utilisateurs", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

function mockAuth() {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "admin@example.com",
      name: "Admin",
      role: "FINANCE_ADMIN",
      departementId: "d-1",
      departement: "Finance",
      poste: "Admin",
    },
  }
}

const validUserPayload = {
  email: "user@example.com",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE",
  societeId: "soc-1",
  departementId: "d-1",
}

describe("utilisateurs route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of Utilisateur", async () => {
    const { requireAuth } = await import("@/lib/auth")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "u-2", email: "user@example.com" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ users: [{ id: "u-2", email: "user@example.com" }] })
  })

  it("GET returns 404 when the service throws UtilisateurNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UtilisateurNotFoundError()
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Utilisateur introuvable")
  })

  it("POST returns 404 when the service throws UtilisateurNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UtilisateurNotFoundError()
    )

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validUserPayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Utilisateur introuvable")
  })

  it("PUT returns 404 when the service throws UtilisateurNotFoundError", async () => {
    const { requireAuth } = await import("@/lib/auth")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UtilisateurNotFoundError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "u-2", ...validUserPayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Utilisateur introuvable")
  })
})
