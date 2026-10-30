import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// #284: only the SESSION is faked here. `requireAnyRole` stays REAL, so the
// admission cases below assert what the declared set in `lib/auth/roles.ts`
// admits rather than what a hand-rolled copy of the rule admits. The Societe
// MODULE (`lib/societe`) is mocked wholesale — its transaction, validation,
// read scope and failure visibility are ADR-0012's subject and are not what
// this ticket decides.
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, requireAuth: vi.fn(), getAuthUser: vi.fn() }
})

vi.mock("@/lib/societe", () => ({
  getSocieteBranding: vi.fn(),
  updateSociete: vi.fn(),
}))

function mockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/societe", {
    method: "PATCH",
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

const validSocietePayload = { nom: "Nouvelle Société", couleurPrimaire: null }

describe("societe route", { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the public branding to an unauthenticated caller", async () => {
    const { getSocieteBranding } = await import("@/lib/societe")
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "s-1",
      nom: "Ma Société",
      logoUrl: null,
      faviconUrl: null,
      couleurPrimaire: "#123456",
    })

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    // Visual identity only — the EmailSender identity fields are never exposed
    // here (ADR-0012).
    expect(body).not.toHaveProperty("domaineEmail")
    expect(body).not.toHaveProperty("nomExpediteurEmail")
  })

  it("GET returns 404 when no Societe is configured", async () => {
    const { getSocieteBranding } = await import("@/lib/societe")
    ;(getSocieteBranding as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Aucune société configurée")
  })

  it("PATCH writes the Societe for a Role inside the set", async () => {
    await signInAs("FINANCE_ADMIN")
    const { updateSociete } = await import("@/lib/societe")
    ;(updateSociete as ReturnType<typeof vi.fn>).mockResolvedValue(
      validSocietePayload
    )

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest(validSocietePayload), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    expect(updateSociete).toHaveBeenCalledOnce()
    const [changes, actorId] = (updateSociete as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(changes).toEqual(validSocietePayload)
    expect(actorId).toBe("u-1")
  })

  it("PATCH returns 400 when the body fails societeUpdateSchema", async () => {
    await signInAs("FINANCE_ADMIN")
    const { updateSociete } = await import("@/lib/societe")

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest({}), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(400)
    expect(updateSociete).not.toHaveBeenCalled()
  })
})

// #284: the Societe write asks the declared set (`ROLES_MANAGEMENT`) and the
// REAL guard decides. GENERAL_DIRECTION being ADMITTED is the whole point of
// this ticket — before it the write named one Role, so a Direction Générale
// was refused its own Societe.
describe("societe route — ROLES_MANAGEMENT guards the Societe write", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("PATCH admits a Direction Générale and reaches updateSociete", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { updateSociete } = await import("@/lib/societe")
    ;(updateSociete as ReturnType<typeof vi.fn>).mockResolvedValue(
      validSocietePayload
    )

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest(validSocietePayload), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(validSocietePayload)
    expect(updateSociete).toHaveBeenCalledOnce()
  })

  it("PATCH admits FINANCE_ADMIN — nothing is taken from that Role", async () => {
    await signInAs("FINANCE_ADMIN")
    const { updateSociete } = await import("@/lib/societe")
    ;(updateSociete as ReturnType<typeof vi.fn>).mockResolvedValue(
      validSocietePayload
    )

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest(validSocietePayload), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    expect(updateSociete).toHaveBeenCalledOnce()
  })

  it("PATCH refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { updateSociete } = await import("@/lib/societe")

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest(validSocietePayload), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(updateSociete).not.toHaveBeenCalled()
  })

  it("PATCH refuses an EMPLOYEE with the same 403 « Accès refusé »", async () => {
    await signInAs("EMPLOYEE")
    const { updateSociete } = await import("@/lib/societe")

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest(validSocietePayload), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(updateSociete).not.toHaveBeenCalled()
  })
})
