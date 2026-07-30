import { describe, it, expect, vi } from "vitest"
import { logAudit } from "./audit"
import { VehiculeService, VehiculeNotFoundError } from "./vehicule-service"

vi.mock("./audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

function mockDb() {
  const returningCreate = vi.fn()
  const returningUpdate = vi.fn()
  const returningDelete = vi.fn()

  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: returningCreate })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: returningUpdate })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: returningDelete })),
    })),
    query: {
      vehiculesEntreprise: {
        findMany: vi.fn(),
      },
    },
  }
}

const makeVehicule = (overrides?: Record<string, unknown>) => ({
  id: "v-1",
  nom: "Renault Clio",
  immatriculation: "AB-123-CD",
  disponible: true,
  creeLe: new Date("2025-01-01"),
  ...overrides,
})

describe("VehiculeService", () => {
  it("lists all vehicules ordered by nom asc", async () => {
    const db = mockDb()
    const vehicules = [makeVehicule({ nom: "Audi" }), makeVehicule({ id: "v-2", nom: "BMW" })]
    db.query.vehiculesEntreprise.findMany.mockResolvedValue(vehicules)

    const svc = new VehiculeService(db as any)
    const result = await svc.list()

    expect(result).toHaveLength(2)
    expect(result[0].nom).toBe("Audi")
    expect(db.query.vehiculesEntreprise.findMany).toHaveBeenCalledWith({
      orderBy: [expect.any(Object)],
    })
  })

  it("creates a vehicule and audits", async () => {
    const db = mockDb()
    const returningCreate = db.insert().values().returning as ReturnType<typeof vi.fn>
    returningCreate.mockResolvedValue([makeVehicule({ nom: "Peugeot 208", immatriculation: "XY-456-ZZ" })])

    const svc = new VehiculeService(db as any)
    const result = await svc.create(
      { nom: "Peugeot 208", immatriculation: "XY-456-ZZ" },
      "u-1"
    )

    expect(result.nom).toBe("Peugeot 208")
    expect(result.immatriculation).toBe("XY-456-ZZ")
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "CREATION_VEHICULE",
        entite: "VehiculeEntreprise",
      }),
      expect.anything(),
    )
  })

  it("creates a vehicule with disponible defaulting to true", async () => {
    const db = mockDb()
    const returningCreate = db.insert().values().returning as ReturnType<typeof vi.fn>
    returningCreate.mockImplementation((data: any) =>
      Promise.resolve([makeVehicule({ ...data })] as any)
    )

    const svc = new VehiculeService(db as any)
    const result = await svc.create(
      { nom: "Tesla", immatriculation: "ZZ-999-AA" },
      "u-1"
    )

    expect(result.disponible).toBe(true)
  })

  it("updates a vehicule and audits", async () => {
    const db = mockDb()
    db.update().set().where().returning.mockResolvedValue([makeVehicule({ nom: "Renault Megane", immatriculation: "CD-789-EF" })])

    const svc = new VehiculeService(db as any)
    const result = await svc.update(
      "v-1",
      { nom: "Renault Megane", immatriculation: "CD-789-EF" },
      "u-1"
    )

    expect(result.nom).toBe("Renault Megane")
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "MODIFICATION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: "v-1",
      }),
      expect.anything(),
    )
  })

  it("throws VehiculeNotFoundError when updating non-existent vehicule", async () => {
    const db = mockDb()
    db.update().set().where().returning.mockResolvedValue([])

    const svc = new VehiculeService(db as any)
    await expect(
      svc.update("v-missing", { nom: "Ghost" }, "u-1")
    ).rejects.toThrow(VehiculeNotFoundError)
  })

  it("deletes a vehicule and audits", async () => {
    const db = mockDb()
    db.delete().where().returning.mockResolvedValue([makeVehicule()])

    const svc = new VehiculeService(db as any)
    await svc.delete("v-1", "u-1")

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "SUPPRESSION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: "v-1",
      }),
      expect.anything(),
    )
  })

  it("throws VehiculeNotFoundError when deleting non-existent vehicule", async () => {
    const db = mockDb()
    db.delete().where().returning.mockResolvedValue([])

    const svc = new VehiculeService(db as any)
    await expect(
      svc.delete("v-missing", "u-1")
    ).rejects.toThrow(VehiculeNotFoundError)
  })
})
