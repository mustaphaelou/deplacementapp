import { describe, it, expect, vi, beforeEach } from "vitest"

// #284: only the SESSION is faked here. `requireAnyRole` stays REAL, so the
// admission cases below assert what the declared set in `lib/auth/roles.ts`
// admits. The Societe MODULE (`lib/societe`) is mocked wholesale — this route
// is a thin reader over `getSocieteRow`, and the module's read scope (ADR-0012)
// is not what this ticket decides.
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, requireAuth: vi.fn(), getAuthUser: vi.fn() }
})

vi.mock("@/lib/societe", () => ({
  getSocieteRow: vi.fn(),
}))

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

const rawSocieteRow = {
  id: "s-1",
  nom: "Ma Société",
  logoUrl: null,
  faviconUrl: null,
  couleurPrimaire: "#123456",
  nomExpediteurEmail: "Ma Société",
  domaineEmail: "example.ma",
}

// These suites load the REAL session module (importOriginal above) so the
// declared set decides, which is slower than the wholesale mock they
// replaced. Under a loaded machine the default 5s budget can expire, and a
// timed-out test leaves the module registry half-initialised — the NEXT
// test's dynamic import then gets a real requireAuth instead of the mock
// and fails with a misleading `mockResolvedValue is not a function`.
// Same remedy as app/(dashboard)/demandes/nouvelle/page.test.tsx.
describe("societe identity route", { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the raw Societe row, identity fields included", async () => {
    await signInAs("FINANCE_ADMIN")
    const { getSocieteRow } = await import("@/lib/societe")
    ;(getSocieteRow as ReturnType<typeof vi.fn>).mockResolvedValue(rawSocieteRow)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(rawSocieteRow)
    // The RAW stored value, never the composed noreply@<domain>.
    expect(body.domaineEmail).toBe("example.ma")
  })

  it("GET returns 404 when no Societe is configured", async () => {
    await signInAs("FINANCE_ADMIN")
    const { getSocieteRow } = await import("@/lib/societe")
    ;(getSocieteRow as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Aucune société configurée")
  })

  it("GET returns 401 when nobody is signed in", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Non autorisé" }, { status: 401 }),
    })
    const { getSocieteRow } = await import("@/lib/societe")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(401)
    expect(getSocieteRow).not.toHaveBeenCalled()
  })
})

// #284: the identity read asks the declared set (`ROLES_MANAGEMENT`) and the
// REAL guard decides. GENERAL_DIRECTION being ADMITTED is the whole point of
// this ticket: this read exposes the EmailSender identity fields, which the
// management form round-trips.
describe("societe identity route — ROLES_MANAGEMENT guards the identity read", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET admits a Direction Générale and reaches getSocieteRow", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { getSocieteRow } = await import("@/lib/societe")
    ;(getSocieteRow as ReturnType<typeof vi.fn>).mockResolvedValue(rawSocieteRow)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.domaineEmail).toBe("example.ma")
    expect(getSocieteRow).toHaveBeenCalledOnce()
  })

  it("GET admits FINANCE_ADMIN — nothing is taken from that Role", async () => {
    await signInAs("FINANCE_ADMIN")
    const { getSocieteRow } = await import("@/lib/societe")
    ;(getSocieteRow as ReturnType<typeof vi.fn>).mockResolvedValue(rawSocieteRow)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    expect(getSocieteRow).toHaveBeenCalledOnce()
  })

  it("GET refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { getSocieteRow } = await import("@/lib/societe")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    // The refusal short-circuits before the identity fields are read.
    expect(getSocieteRow).not.toHaveBeenCalled()
  })

  it("GET refuses an EMPLOYEE with the same 403 « Accès refusé »", async () => {
    await signInAs("EMPLOYEE")
    const { getSocieteRow } = await import("@/lib/societe")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(getSocieteRow).not.toHaveBeenCalled()
  })
})
