import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { UtilisateurNotFoundError } from "@/lib/utilisateur-service"

// #283: only the SESSION is faked here. `requireAnyRole` stays REAL, so these
// tests assert what the declared set in `lib/auth/roles.ts` admits rather than
// what a hand-rolled copy of the rule admits — the previous suite replaced the
// guard with its own `roles.includes(user.role)`, which could only ever prove
// "the route called a guard", never "the guard was handed the right answer".
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, requireAuth: vi.fn(), getAuthUser: vi.fn() }
})

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

function mockUser(role: string) {
  return {
    id: "u-1",
    email: "admin@example.com",
    name: "Admin",
    role,
    departementId: "d-1",
    departement: "Finance",
    poste: "Admin",
  }
}

function mockAuth(role: string) {
  return { ok: true, user: mockUser(role) }
}

async function signInAs(role: string) {
  const { requireAuth } = await import("@/lib/auth/server")
  ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth(role))
  return requireAuth as ReturnType<typeof vi.fn>
}

const validUserPayload = {
  email: "user@example.com",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE",
  departementId: "d-1",
}

describe("utilisateurs route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of Utilisateur", async () => {
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
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
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
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
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
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
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
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

  it("POST accepts a payload without societeId and delegates to the service", async () => {
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(utilisateurService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-2",
      email: "user@example.com",
    })

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validUserPayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ user: { id: "u-2", email: "user@example.com" } })

    const create = utilisateurService.create as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledOnce()
    const [data, actorId] = create.mock.calls[0]
    expect(data).not.toHaveProperty("societeId")
    expect(data).toMatchObject({
      email: "user@example.com",
      departementId: "d-1",
    })
    expect(actorId).toBe("u-1")
  })

  it("PUT accepts the edit payload without societeId", async () => {
    await signInAs("FINANCE_ADMIN")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(utilisateurService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-2",
      email: "user@example.com",
    })

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "u-2", ...validUserPayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(200)
    const update = utilisateurService.update as ReturnType<typeof vi.fn>
    expect(update).toHaveBeenCalledOnce()
    const [id, data] = update.mock.calls[0]
    expect(id).toBe("u-2")
    expect(data).not.toHaveProperty("societeId")
  })
})

// #283: the surface asks the declared set (`ROLES_MANAGEMENT`) and the REAL
// guard decides, so a wrong set is a red test here rather than a silently
// shipped permission change. Every verb the route exposes is checked both ways:
// a Role inside the set reaches the service, a Role outside it is refused with
// the « Accès refusé » 403 the guard already produced.
describe("utilisateurs route — ROLES_MANAGEMENT guards every verb", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET admits a Role inside the set and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(utilisateurService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "u-2", email: "user@example.com" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    expect(utilisateurService.list).toHaveBeenCalledOnce()
  })

  it("GET refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("EMPLOYEE")
    const { utilisateurService } = await import("@/lib/utilisateur-service")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(utilisateurService.list).not.toHaveBeenCalled()
  })

  it("POST admits a Role inside the set and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(utilisateurService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-2",
      email: "user@example.com",
    })

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validUserPayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    expect(utilisateurService.create).toHaveBeenCalledOnce()
  })

  it("POST refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { utilisateurService } = await import("@/lib/utilisateur-service")

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validUserPayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(utilisateurService.create).not.toHaveBeenCalled()
  })

  it("PUT admits a Role inside the set and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { utilisateurService } = await import("@/lib/utilisateur-service")
    ;(utilisateurService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-2",
      email: "user@example.com",
    })

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "u-2", ...validUserPayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(200)
    expect(utilisateurService.update).toHaveBeenCalledOnce()
  })

  it("PUT refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { utilisateurService } = await import("@/lib/utilisateur-service")

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "u-2", ...validUserPayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(utilisateurService.update).not.toHaveBeenCalled()
  })
})
