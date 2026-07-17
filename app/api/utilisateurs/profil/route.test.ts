import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
  AvatarError,
} from "@/lib/utilisateur-service"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/utilisateur-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utilisateur-service")>()
  return {
    ...actual,
    utilisateurService: {
      updateProfile: vi.fn(),
    },
  }
})

function mockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/utilisateurs/profil", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

function mockAuth() {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "a@b.com",
      name: "A",
      role: "EMPLOYEE",
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

describe("profil route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns the updated user on success", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-1",
      email: "new@b.com",
      telephone: "0612345678",
      poste: "Lead",
      avatarUrl: null,
    })

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ poste: "Lead" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user).toEqual({
      id: "u-1",
      email: "new@b.com",
      telephone: "0612345678",
      poste: "Lead",
      avatarUrl: null,
    })
  })

  it("returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 }),
    })

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ poste: "Lead" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(401)
  })

  it("returns 400 for validation errors", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ email: "not-an-email" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Données invalides")
  })

  it("returns 404 when the user is not found", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UtilisateurNotFoundError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ poste: "Lead" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Utilisateur introuvable")
  })

  it("returns 400 when the current password is incorrect", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new MotDePasseIncorrectError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ email: "new@b.com", currentPassword: "wrong" }),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Mot de passe actuel incorrect")
  })

  it("returns 400 when the email change request omits the current password", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new EmailChangeRequiresPasswordError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ email: "new@b.com" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Mot de passe requis pour modifier l'email")
  })

  it("returns 400 when no update data is provided", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NoProfileUpdateDataError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({}), { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Aucune donnée à modifier")
  })

  it("returns the avatar error status when avatar storage fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth())
    ;(utilisateurService.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AvatarError("L'image ne doit pas dépasser 2 Mo", 400)
    )

    const { PUT } = await import("./route")
    const response = await PUT(mockRequest({ avatarData: "data:image/png;base64,abc" }), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("L'image ne doit pas dépasser 2 Mo")
  })
})
