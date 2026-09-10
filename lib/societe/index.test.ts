import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { journalAudit } from "../../db/schema/journal-audit"
import {
  getSocieteBranding,
  getSocieteRow,
  loadSocieteIdentity,
  updateSociete,
  clearSocieteCache,
} from "./index"
import type { SocieteIdentity, SocieteBranding } from "./index"

const TIMEOUT = 30_000

describe("Societe module", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM journal_audit`)
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)
    clearSocieteCache()
  })

  describe("loadSocieteIdentity", () => {
    it("returns SocieteIdentity from DB row", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "s1",
        nom: "Test Inc",
        nomExpediteurEmail: "Test Sender",
        domaineEmail: "test.ma",
        modifieLe: new Date(),
      })

      const identity = await loadSocieteIdentity()
      expect(identity).toEqual<SocieteIdentity>({
        nomExpediteurEmail: "Test Sender",
        domaineEmail: "noreply@test.ma",
      })
    })

    it("is memoized: second call returns cached values without re-querying", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "s2",
        nom: "Memo Inc",
        nomExpediteurEmail: "Memo Sender",
        domaineEmail: "memo.ma",
        modifieLe: new Date(),
      })

      const first = await loadSocieteIdentity()
      expect(first.nomExpediteurEmail).toBe("Memo Sender")

      await pgliteDb
        .update(schema.societes)
        .set({
          nomExpediteurEmail: "Mutated Sender",
          domaineEmail: "mutated.ma",
        })
        .where(eq(schema.societes.id, "s2"))

      const second = await loadSocieteIdentity()
      expect(second.nomExpediteurEmail).toBe("Memo Sender")
      expect(second.domaineEmail).toBe("noreply@memo.ma")
    })

    it("returns env fallback when Societe row has null email fields", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "s3",
        nom: "Partial Inc",
        modifieLe: new Date(),
      })

      const identity = await loadSocieteIdentity()
      expect(identity).toEqual<SocieteIdentity>({
        nomExpediteurEmail: "Notification",
        domaineEmail: "noreply@exemple.ma",
      })
    })

    it("returns env fallback when no Societe row exists", async () => {
      const identity = await loadSocieteIdentity()
      expect(identity).toEqual<SocieteIdentity>({
        nomExpediteurEmail: "Notification",
        domaineEmail: "noreply@exemple.ma",
      })
    })

    it("clearSocieteCache forces re-query on next call", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "s4",
        nom: "Cache Test",
        nomExpediteurEmail: "Original Sender",
        domaineEmail: "original.ma",
        modifieLe: new Date(),
      })

      const first = await loadSocieteIdentity()
      expect(first.nomExpediteurEmail).toBe("Original Sender")

      await pgliteDb
        .update(schema.societes)
        .set({
          nomExpediteurEmail: "Updated Sender",
          domaineEmail: "updated.ma",
        })
        .where(eq(schema.societes.id, "s4"))

      clearSocieteCache()

      const second = await loadSocieteIdentity()
      expect(second).toEqual<SocieteIdentity>({
        nomExpediteurEmail: "Updated Sender",
        domaineEmail: "noreply@updated.ma",
      })
    })
  })

  describe("getSocieteBranding", () => {
    it("returns the visual identity fields from the Societe row", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "b1",
        nom: "Brand Corp",
        logoUrl: "/logo.png",
        faviconUrl: "/favicon.ico",
        couleurPrimaire: "#ff0000",
        nomExpediteurEmail: "Brand Sender",
        domaineEmail: "brand.ma",
        modifieLe: new Date(),
      })

      // ADR-0012: the public reader carries IdentiteVisuelle only — never the
      // EmailSender identity fields.
      const branding = await getSocieteBranding()
      expect(branding).toEqual<SocieteBranding>({
        id: "b1",
        nom: "Brand Corp",
        logoUrl: "/logo.png",
        faviconUrl: "/favicon.ico",
        couleurPrimaire: "#ff0000",
      })
    })

    it("returns null when no Societe row exists", async () => {
      const branding = await getSocieteBranding()
      expect(branding).toBeNull()
    })

    it("does not include email identity fields even when set on the row", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "b2",
        nom: "Partial Brand",
        logoUrl: null,
        faviconUrl: null,
        couleurPrimaire: null,
        nomExpediteurEmail: "Secret Sender",
        domaineEmail: "secret.ma",
        modifieLe: new Date(),
      })

      const branding = await getSocieteBranding()
      expect(branding).not.toHaveProperty("nomExpediteurEmail")
      expect(branding).not.toHaveProperty("domaineEmail")
    })
  })

  describe("getSocieteRow", () => {
    it("returns the raw row including stored NomExpediteurEmail and DomaineEmail", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "r1",
        nom: "Row Corp",
        couleurPrimaire: "#00ff00",
        nomExpediteurEmail: "Raw Sender",
        domaineEmail: "raw.ma",
        modifieLe: new Date(),
      })

      const row = await getSocieteRow()
      expect(row).toEqual({
        id: "r1",
        nom: "Row Corp",
        logoUrl: null,
        faviconUrl: null,
        couleurPrimaire: "#00ff00",
        // Raw stored values — NOT the composed noreply@<domain> identity.
        nomExpediteurEmail: "Raw Sender",
        domaineEmail: "raw.ma",
      })
    })

    it("returns null when no Societe row exists", async () => {
      expect(await getSocieteRow()).toBeNull()
    })
  })

  describe("updateSociete", () => {
    let actorId: string
    let societeId: string
    let departementId: string

    beforeEach(async () => {
      actorId = crypto.randomUUID()
      societeId = crypto.randomUUID()
      departementId = crypto.randomUUID()

      await pgliteDb.insert(schema.societes).values({
        id: societeId,
        nom: "Test Societe",
        nomExpediteurEmail: "Sender",
        domaineEmail: "domain.ma",
        modifieLe: new Date(),
      })

      await pgliteDb.insert(schema.departements).values({
        id: departementId,
        nom: "Direction",
        societeId,
      })

      await pgliteDb.insert(schema.utilisateurs).values({
        id: actorId,
        email: "actor@test.com",
        nom: "Actor",
        prenom: "Test",
        poste: "Admin",
        role: "GENERAL_DIRECTION",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      })
    })

    it("updates database row and returns changed fields", async () => {
      const result = await updateSociete(
        { nom: "New Name", nomExpediteurEmail: "New Sender" },
        actorId
      )

      expect(result).toEqual({
        nom: "New Name",
        nomExpediteurEmail: "New Sender",
      })

      const [row] = await pgliteDb
        .select()
        .from(schema.societes)
        .where(eq(schema.societes.id, societeId))
      expect(row.nom).toBe("New Name")
      expect(row.nomExpediteurEmail).toBe("New Sender")
    })

    it("writes the row and the JournalAudit entry in one transaction (both or neither)", async () => {
      // ADR-0012: the audit row exists for a committed change…
      await updateSociete({ nom: "Atomic Name" }, actorId)
      const auditRows = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entite, "Societe"))
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].utilisateurId).toBe(actorId)

      // …and when the audit write fails, the row write rolls back with it.
      // (`updateSociete` throws when the acting utilisateur no longer exists —
      // the transaction aborts, so the row keeps its previous value.)
      await pgliteDb.execute(sql`DELETE FROM journal_audit`)
      await pgliteDb.execute(
        sql`DELETE FROM utilisateurs WHERE id = ${actorId}`
      )

      await expect(
        updateSociete({ nom: "Should Roll Back" }, actorId)
      ).rejects.toThrow()
      const [row] = await pgliteDb
        .select()
        .from(schema.societes)
        .where(eq(schema.societes.id, societeId))
      expect(row.nom).toBe("Atomic Name")
    })

    it("invalidates cached identity after update", async () => {
      await loadSocieteIdentity()
      await updateSociete(
        { nomExpediteurEmail: "New Sender", domaineEmail: "new.ma" },
        actorId
      )

      const identity = await loadSocieteIdentity()
      expect(identity).toEqual<SocieteIdentity>({
        nomExpediteurEmail: "New Sender",
        domaineEmail: "noreply@new.ma",
      })
    })

    it("writes a journal_audit row via logAudit", async () => {
      await updateSociete({ nom: "Updated Name" }, actorId)

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entite, "Societe"))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actorId)
      expect(auditRow.action).toBe("MODIFIER_SOCIETE")
      expect(auditRow.entiteId).toBe(societeId)
      expect(JSON.parse(auditRow.details as string)).toEqual({
        changes: ["nom"],
      })
    })

    it("throws when no Societe row exists", async () => {
      await pgliteDb.execute(
        sql`DELETE FROM utilisateurs WHERE id = ${actorId}`
      )
      await pgliteDb.execute(
        sql`DELETE FROM departements WHERE id = ${departementId}`
      )
      await pgliteDb.execute(sql`DELETE FROM societes`)
      await expect(
        updateSociete({ nom: "Should Fail" }, actorId)
      ).rejects.toThrow("Aucune société configurée")
    })

    it("rejects an empty change-set (route validation lives in societeUpdateSchema, ADR-0012)", async () => {
      await expect(updateSociete({} as never, actorId)).rejects.toThrow(
        "Aucune donnée à mettre à jour"
      )
    })

    it("ignores unknown keys instead of persisting them (defense in depth behind .strict())", async () => {
      await updateSociete(
        { nom: "Updated", unknownField: "should be ignored" } as never,
        actorId
      )

      const [row] = await pgliteDb
        .select()
        .from(schema.societes)
        .where(eq(schema.societes.id, societeId))
      expect(row.nom).toBe("Updated")
    })
  })
})
