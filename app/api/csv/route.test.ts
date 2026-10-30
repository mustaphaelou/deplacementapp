import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DemandeExportRow } from "@/lib/demande"

// #283: only the SESSION is faked here. `requireAnyRole` stays REAL, so the
// admission cases below assert what the declared set in `lib/auth/roles.ts`
// admits rather than what a hand-rolled copy of the rule admits.
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, requireAuth: vi.fn(), getAuthUser: vi.fn() }
})

vi.mock("@/lib/demande", () => ({
  findAllForExport: vi.fn(),
}))

const mockExportRows: DemandeExportRow[] = [
  {
    numero: "DD-2025-0001",
    destination: "Casablanca",
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    typeTransport: "AVION",
    motif: '["mission_client"]',
    totalEstime: 380,
    etape: "FINAL",
    decision: "APPROVED",
    creeLe: new Date("2025-05-24T10:00:00.000Z"),
    employe: { prenom: "Jean", nom: "Dupont" },
  },
  {
    numero: "DD-2025-0002",
    destination: "Rabat",
    dateDepart: new Date("2025-07-10"),
    dateRetour: new Date("2025-07-12"),
    typeTransport: "BUS",
    motif: '["formation"]',
    totalEstime: null,
    etape: "MANAGER_REVIEW",
    decision: "PENDING",
    creeLe: new Date("2025-06-15T08:30:00.000Z"),
    employe: null,
  },
  {
    // A decided (rejected) row: the stage-naming compact label must reach the
    // « Statut » cell, never the raw Etape code.
    numero: "DD-2025-0003",
    destination: "Fes",
    dateDepart: new Date("2025-08-02"),
    dateRetour: new Date("2025-08-04"),
    typeTransport: "TRAIN",
    motif: '["reunion"]',
    totalEstime: 1200,
    etape: "FINANCE_REVIEW",
    decision: "REJECTED",
    creeLe: new Date("2025-06-20T09:15:00.000Z"),
    employe: { prenom: "Amina", nom: "Alaoui" },
  },
  {
    // An unmapped TypeTransport code: the stored value renders verbatim.
    numero: "DD-2025-0004",
    destination: "Essaouira",
    dateDepart: new Date("2025-09-01"),
    dateRetour: new Date("2025-09-03"),
    typeTransport: "HYPERLOOP",
    motif: '["maintenance"]',
    totalEstime: 450,
    etape: "DIRECTION_REVIEW",
    decision: "PENDING",
    creeLe: new Date("2025-06-25T07:00:00.000Z"),
    employe: null,
  },
]

function mockAuth(role = "FINANCE_ADMIN") {
  return {
    ok: true,
    user: {
      id: "u-1",
      email: "user@example.com",
      name: "User",
      role,
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

async function signInAs(role: string) {
  const { requireAuth } = await import("@/lib/auth/server")
  ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth(role))
  return requireAuth as ReturnType<typeof vi.fn>
}

describe("CSV export route", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET exports demandes through the queries port and returns CSV", async () => {
    const requireAuth = await signInAs("FINANCE_ADMIN")
    const { findAllForExport } = await import("@/lib/demande")

    expect(requireAuth).toBeDefined()
    ;(findAllForExport as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockExportRows
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(findAllForExport).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")

    const csv = await response.text()
    expect(csv).toContain(
      "Numero,Employe,Destination,DateDepart,DateRetour,Transport,Total,Statut,CreeLe"
    )
    // Row 1 — a decided (approved) row: the Decision reaches the file through
    // the labelled « Statut », and the Transport is its label.
    expect(csv).toContain(
      '"DD-2025-0001","Jean Dupont","Casablanca","2025-06-01","2025-06-05","Avion","380","Approuvée","2025-05-24T10:00:00.000Z"'
    )
    // Row 2 — still pending, shown by the stage it sits at.
    expect(csv).toContain(
      '"DD-2025-0002","","Rabat","2025-07-10","2025-07-12","Bus / Car","0","En attente (Manager)","2025-06-15T08:30:00.000Z"'
    )
    // Row 3 — a rejection names the stage where it happened.
    expect(csv).toContain(
      '"DD-2025-0003","Amina Alaoui","Fes","2025-08-02","2025-08-04","Train","1200","Rejetée (Finance)","2025-06-20T09:15:00.000Z"'
    )
    // Row 4 — an unmapped transport code falls back to the stored value.
    expect(csv).toContain(
      '"DD-2025-0004","","Essaouira","2025-09-01","2025-09-03","HYPERLOOP","450","En attente (Direction)","2025-06-25T07:00:00.000Z"'
    )
  })

  it("GET returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth/server")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
      }),
    })

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(401)
  })

  it("GET returns 403 when role is not authorised", async () => {
    await signInAs("EMPLOYEE")
    const { findAllForExport } = await import("@/lib/demande")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    // The refusal short-circuits before any row is read.
    expect(findAllForExport).not.toHaveBeenCalled()
  })

  it("GET returns 500 when the queries port throws", async () => {
    await signInAs("FINANCE_ADMIN")
    const { findAllForExport } = await import("@/lib/demande")

    ;(findAllForExport as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
  })
})

// #283: the export asks the declared set (`ROLES_MANAGEMENT`) and the REAL
// guard decides. Admission is proven for a Role inside the set, refusal for one
// outside it, so a wrong set is a red test rather than a silent leak of the
// whole DemandeDeplacement history.
describe("CSV export route — ROLES_MANAGEMENT guards the export", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET admits a Role inside the set and produces the file", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { findAllForExport } = await import("@/lib/demande")
    ;(findAllForExport as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockExportRows
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")
    expect(await response.text()).toContain("DD-2025-0001")
    expect(findAllForExport).toHaveBeenCalledOnce()
  })

  it("GET refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { findAllForExport } = await import("@/lib/demande")

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(findAllForExport).not.toHaveBeenCalled()
  })
})
