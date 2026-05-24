import { describe, it, expect, vi } from "vitest"
import { VehiculeService, VehiculeNotFoundError } from "./vehicule-service"
import type { AuditBus } from "./audit-bus"
import type { PrismaClient, VehiculeEntreprise } from "@prisma/client"

function mockAudit(): AuditBus & { log: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditBus & { log: ReturnType<typeof vi.fn> }
}

interface MockedDb {
  vehiculeEntreprise: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    vehiculeEntreprise: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

const makeVehicule = (overrides?: Partial<VehiculeEntreprise>): VehiculeEntreprise => ({
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
    const audit = mockAudit()
    const vehicules = [makeVehicule({ nom: "Audi" }), makeVehicule({ id: "v-2", nom: "BMW" })]
    db.vehiculeEntreprise.findMany.mockResolvedValue(vehicules)

    const svc = new VehiculeService(db as unknown as PrismaClient, audit)
    const result = await svc.list()

    expect(result).toHaveLength(2)
    expect(result[0].nom).toBe("Audi")
    expect(db.vehiculeEntreprise.findMany).toHaveBeenCalledWith({
      orderBy: { nom: "asc" },
    })
  })

  it("creates a vehicule and audits", async () => {
    const db = mockDb()
    const audit = mockAudit()
    db.vehiculeEntreprise.create.mockResolvedValue(makeVehicule({ nom: "Peugeot 208", immatriculation: "XY-456-ZZ" }))

    const svc = new VehiculeService(db as unknown as PrismaClient, audit)
    const result = await svc.create(
      { nom: "Peugeot 208", immatriculation: "XY-456-ZZ" },
      "u-1"
    )

    expect(result.nom).toBe("Peugeot 208")
    expect(result.immatriculation).toBe("XY-456-ZZ")
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "CREATION_VEHICULE",
        entite: "VehiculeEntreprise",
      })
    )
  })

  it("creates a vehicule with disponible defaulting to true", async () => {
    const db = mockDb()
    const audit = mockAudit()
    db.vehiculeEntreprise.create.mockImplementation((args: any) =>
      Promise.resolve(makeVehicule(args.data))
    )

    const svc = new VehiculeService(db as unknown as PrismaClient, audit)
    const result = await svc.create(
      { nom: "Tesla", immatriculation: "ZZ-999-AA" },
      "u-1"
    )

    expect(result.disponible).toBe(true)
  })

  it("updates a vehicule and audits", async () => {
    const db = mockDb()
    const audit = mockAudit()
    db.vehiculeEntreprise.update.mockResolvedValue(makeVehicule({ nom: "Renault Megane", immatriculation: "CD-789-EF" }))

    const svc = new VehiculeService(db as unknown as PrismaClient, audit)
    const result = await svc.update(
      "v-1",
      { nom: "Renault Megane", immatriculation: "CD-789-EF" },
      "u-1"
    )

    expect(result.nom).toBe("Renault Megane")
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "MODIFICATION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: "v-1",
      })
    )
  })

  it("throws VehiculeNotFoundError when updating non-existent vehicule", async () => {
    const db = mockDb()
    db.vehiculeEntreprise.update.mockRejectedValue(new Error("Record to update not found"))

    const svc = new VehiculeService(db as unknown as PrismaClient, mockAudit())
    await expect(
      svc.update("v-missing", { nom: "Ghost" }, "u-1")
    ).rejects.toThrow(VehiculeNotFoundError)
  })

  it("deletes a vehicule and audits", async () => {
    const db = mockDb()
    const audit = mockAudit()
    db.vehiculeEntreprise.delete.mockResolvedValue(makeVehicule())

    const svc = new VehiculeService(db as unknown as PrismaClient, audit)
    await svc.delete("v-1", "u-1")

    expect(db.vehiculeEntreprise.delete).toHaveBeenCalledWith({ where: { id: "v-1" } })
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "SUPPRESSION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: "v-1",
      })
    )
  })

  it("throws VehiculeNotFoundError when deleting non-existent vehicule", async () => {
    const db = mockDb()
    db.vehiculeEntreprise.delete.mockRejectedValue(new Error("Record to delete not found"))

    const svc = new VehiculeService(db as unknown as PrismaClient, mockAudit())
    await expect(
      svc.delete("v-missing", "u-1")
    ).rejects.toThrow(VehiculeNotFoundError)
  })
})
