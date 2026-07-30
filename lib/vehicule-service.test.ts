import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { sql, eq } from "drizzle-orm"
import * as schema from "../db/schema"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import * as auditModule from "./audit"
import { journalAudit } from "../db/schema/journal-audit"
import { vehiculesEntreprise } from "../db/schema/vehicules-entreprise"
import { VehiculeService, VehiculeNotFoundError } from "./vehicule-service"

const TIMEOUT = 30_000

describe("VehiculeService", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let svc: VehiculeService
  let actorId: string
  let societeId: string
  let departementId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM journal_audit`)
    await pgliteDb.execute(sql`DELETE FROM vehicules_entreprise`)
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)

    actorId = crypto.randomUUID()
    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Test Societe",
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Test Departement",
      societeId,
    })

    await pgliteDb.insert(schema.utilisateurs).values({
      id: actorId,
      email: "actor@test.com",
      nom: "Test",
      prenom: "User",
      poste: "Test",
      role: "FINANCE_ADMIN",
      departementId,
      societeId,
      actif: true,
      modifieLe: new Date(),
    })

    svc = new VehiculeService(pgliteDb as any)
  })

  describe("list", () => {
    it("returns all vehicules ordered by nom asc", async () => {
      await pgliteDb.insert(vehiculesEntreprise).values([
        { id: "v-1", nom: "Renault Clio", immatriculation: "AB-123-CD", disponible: true },
        { id: "v-2", nom: "Audi A3", immatriculation: "XY-456-ZZ", disponible: true },
        { id: "v-3", nom: "BMW Serie 1", immatriculation: "CD-789-EF", disponible: false },
      ])

      const result = await svc.list()

      expect(result).toHaveLength(3)
      expect(result[0].nom).toBe("Audi A3")
      expect(result[1].nom).toBe("BMW Serie 1")
      expect(result[2].nom).toBe("Renault Clio")
    })
  })

  describe("create", () => {
    it("inserts a vehicule row and writes journal_audit", async () => {
      const vehicule = await svc.create(
        { nom: "Peugeot 208", immatriculation: "XY-456-ZZ" },
        actorId
      )

      expect(vehicule.nom).toBe("Peugeot 208")
      expect(vehicule.immatriculation).toBe("XY-456-ZZ")
      expect(vehicule.disponible).toBe(true)

      const [row] = await pgliteDb
        .select()
        .from(vehiculesEntreprise)
        .where(eq(vehiculesEntreprise.id, vehicule.id))
      expect(row).toBeDefined()
      expect(row.nom).toBe("Peugeot 208")

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, vehicule.id))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actorId)
      expect(auditRow.action).toBe("CREATION_VEHICULE")
    })

    it("defaults disponible to true", async () => {
      const vehicule = await svc.create(
        { nom: "Tesla", immatriculation: "ZZ-999-AA" },
        actorId
      )

      expect(vehicule.disponible).toBe(true)
    })

    it("rolls back when logAudit fails (no rows inserted)", async () => {
      const spy = vi.spyOn(auditModule, "logAudit").mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.create({ nom: "Rollback", immatriculation: "RB-000-XX" }, actorId)
      ).rejects.toThrow("audit failure")

      const rows = await pgliteDb.select().from(vehiculesEntreprise)
      expect(rows).toHaveLength(0)

      spy.mockRestore()
    })
  })

  describe("update", () => {
    let vehiculeId: string

    beforeEach(async () => {
      vehiculeId = crypto.randomUUID()
      await pgliteDb.insert(vehiculesEntreprise).values({
        id: vehiculeId,
        nom: "Renault Clio",
        immatriculation: "AB-123-CD",
        disponible: true,
      })
    })

    it("updates a vehicule row and writes journal_audit", async () => {
      const result = await svc.update(
        vehiculeId,
        { nom: "Renault Megane", immatriculation: "CD-789-EF" },
        actorId
      )

      expect(result.nom).toBe("Renault Megane")
      expect(result.immatriculation).toBe("CD-789-EF")

      const [row] = await pgliteDb
        .select()
        .from(vehiculesEntreprise)
        .where(eq(vehiculesEntreprise.id, vehiculeId))
      expect(row.nom).toBe("Renault Megane")
      expect(row.immatriculation).toBe("CD-789-EF")

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, vehiculeId))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actorId)
      expect(auditRow.action).toBe("MODIFICATION_VEHICULE")
    })

    it("rolls back when logAudit fails (original values preserved)", async () => {
      const spy = vi.spyOn(auditModule, "logAudit").mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.update(vehiculeId, { nom: "Should Not Stick" }, actorId)
      ).rejects.toThrow("audit failure")

      const [row] = await pgliteDb
        .select()
        .from(vehiculesEntreprise)
        .where(eq(vehiculesEntreprise.id, vehiculeId))
      expect(row.nom).toBe("Renault Clio")
      expect(row.immatriculation).toBe("AB-123-CD")

      spy.mockRestore()
    })

    it("throws VehiculeNotFoundError when vehicule does not exist", async () => {
      await expect(
        svc.update("v-missing", { nom: "Ghost" }, actorId)
      ).rejects.toThrow(VehiculeNotFoundError)
    })
  })

  describe("delete", () => {
    let vehiculeId: string

    beforeEach(async () => {
      vehiculeId = crypto.randomUUID()
      await pgliteDb.insert(vehiculesEntreprise).values({
        id: vehiculeId,
        nom: "Renault Clio",
        immatriculation: "AB-123-CD",
        disponible: true,
      })
    })

    it("deletes a vehicule row and writes journal_audit", async () => {
      await svc.delete(vehiculeId, actorId)

      const rows = await pgliteDb
        .select()
        .from(vehiculesEntreprise)
        .where(eq(vehiculesEntreprise.id, vehiculeId))
      expect(rows).toHaveLength(0)

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, vehiculeId))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actorId)
      expect(auditRow.action).toBe("SUPPRESSION_VEHICULE")
    })

    it("rolls back when logAudit fails (row still present)", async () => {
      const spy = vi.spyOn(auditModule, "logAudit").mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.delete(vehiculeId, actorId)
      ).rejects.toThrow("audit failure")

      const [row] = await pgliteDb
        .select()
        .from(vehiculesEntreprise)
        .where(eq(vehiculesEntreprise.id, vehiculeId))
      expect(row).toBeDefined()
      expect(row.nom).toBe("Renault Clio")

      spy.mockRestore()
    })

    it("throws VehiculeNotFoundError when vehicule does not exist", async () => {
      await expect(
        svc.delete("v-missing", actorId)
      ).rejects.toThrow(VehiculeNotFoundError)
    })
  })
})
