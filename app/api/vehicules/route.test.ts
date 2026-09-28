import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { VehiculeNotFoundError } from "@/lib/vehicule-service"

// #284: only the SESSION is faked here. `requireAnyRole` stays REAL, so these
// tests assert what the declared set in `lib/auth/roles.ts` admits rather than
// what a hand-rolled copy of the rule admits — the previous suite replaced the
// guard with its own `user.role === role`, which could only ever prove "the
// route called a guard", never "the guard was handed the right answer".
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, requireAuth: vi.fn(), getAuthUser: vi.fn() }
})

vi.mock("@/lib/vehicule-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vehicule-service")>()
  return {
    ...actual,
    vehiculeService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

function mockRequest(body: unknown, method: string): NextRequest {
  return new NextRequest("http://localhost/api/vehicules", {
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

const validVehiculePayload = {
  nom: "Peugeot 208",
  immatriculation: "AB-123-CD",
}

describe("vehicules route", { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET returns the list of VehiculeEntreprise", async () => {
    await signInAs("FINANCE_ADMIN")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-1", nom: "Peugeot 208" },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([{ id: "v-1", nom: "Peugeot 208" }])
  })

  it("GET returns 404 when the service throws VehiculeNotFoundError", async () => {
    await signInAs("FINANCE_ADMIN")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("POST returns 404 when the service throws VehiculeNotFoundError", async () => {
    await signInAs("FINANCE_ADMIN")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest(validVehiculePayload, "POST"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("PUT returns 404 when the service throws VehiculeNotFoundError", async () => {
    await signInAs("FINANCE_ADMIN")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "v-1", ...validVehiculePayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })

  it("DELETE returns 404 when the service throws VehiculeNotFoundError", async () => {
    await signInAs("FINANCE_ADMIN")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VehiculeNotFoundError()
    )

    const { DELETE } = await import("./route")
    const response = await DELETE(mockRequest({ id: "v-1" }, "DELETE"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Vehicule introuvable")
  })
})

// #284: the three writes ask the declared set (`ROLES_MANAGEMENT`) and the REAL
// guard decides, so a wrong set is a red test here rather than a silently
// shipped permission change. Every write is checked both ways: a Role inside
// the set reaches the service, a Role outside it is refused with the
// « Accès refusé » 403 the guard already produced.
describe("vehicules route — ROLES_MANAGEMENT guards every write", { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("POST admits a Direction Générale and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "v-1",
      nom: "Peugeot 208",
    })

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validVehiculePayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    expect(vehiculeService.create).toHaveBeenCalledOnce()
  })

  it("POST refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { vehiculeService } = await import("@/lib/vehicule-service")

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validVehiculePayload, "POST"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(vehiculeService.create).not.toHaveBeenCalled()
  })

  it("PUT admits a Direction Générale and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "v-1",
      nom: "Peugeot 208",
    })

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "v-1", ...validVehiculePayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(200)
    expect(vehiculeService.update).toHaveBeenCalledOnce()
  })

  it("PUT refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("EMPLOYEE")
    const { vehiculeService } = await import("@/lib/vehicule-service")

    const { PUT } = await import("./route")
    const response = await PUT(
      mockRequest({ id: "v-1", ...validVehiculePayload }, "PUT"),
      { params: Promise.resolve({}) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(vehiculeService.update).not.toHaveBeenCalled()
  })

  it("DELETE admits a Direction Générale and reaches the service", async () => {
    await signInAs("GENERAL_DIRECTION")
    const { vehiculeService } = await import("@/lib/vehicule-service")

    const { DELETE } = await import("./route")
    const response = await DELETE(mockRequest({ id: "v-1" }, "DELETE"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(200)
    expect(vehiculeService.delete).toHaveBeenCalledOnce()
  })

  it("DELETE refuses a Role outside the set with 403 « Accès refusé »", async () => {
    await signInAs("MANAGER")
    const { vehiculeService } = await import("@/lib/vehicule-service")

    const { DELETE } = await import("./route")
    const response = await DELETE(mockRequest({ id: "v-1" }, "DELETE"), {
      params: Promise.resolve({}),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Accès refusé")
    expect(vehiculeService.delete).not.toHaveBeenCalled()
  })
})

// #284: the fleet READ is deliberately open to every signed-in Utilisateur —
// the DemandeDeplacement creation form reads it to populate its
// VehiculeEntreprise picker, so closing it would break DemandeDeplacement
// creation. This pins that open: a Role that every write above refuses still
// reads the fleet. If someone tightens the GET to the declared set, or past it,
// this turns red.
describe(
  "vehicules route — the fleet read stays open to every signed-in Utilisateur",
  { timeout: 30000 },
  () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GET admits a Role the writes refuse (EMPLOYEE) and returns the fleet", async () => {
    await signInAs("EMPLOYEE")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-1", nom: "Peugeot 208", disponible: true },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual([{ id: "v-1", nom: "Peugeot 208", disponible: true }])
    expect(vehiculeService.list).toHaveBeenCalledOnce()
  })

  it("GET admits MANAGER — the other Role outside the set — as well", async () => {
    await signInAs("MANAGER")
    const { vehiculeService } = await import("@/lib/vehicule-service")
    ;(vehiculeService.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "v-1", nom: "Peugeot 208", disponible: true },
    ])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    expect(vehiculeService.list).toHaveBeenCalledOnce()
  })
})
