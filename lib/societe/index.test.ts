import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { journalAudit } from "../../db/schema/journal-audit"
import {
  getSocieteBranding,
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
    it("returns SocieteBranding from DB row", async () => {
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

      const branding = await getSocieteBranding()
      expect(branding).toEqual<SocieteBranding>({
        id: "b1",
        nom: "Brand Corp",
        logoUrl: "/logo.png",
        faviconUrl: "/favicon.ico",
        couleurPrimaire: "#ff0000",
        nomExpediteurEmail: "Brand Sender",
        domaineEmail: "noreply@brand.ma",
      })
    })

    it("returns null when no Societe row exists", async () => {
      const branding = await getSocieteBranding()
      expect(branding).toBeNull()
    })

    it("falls back to env defaults for identity fields when DB has null email fields", async () => {
      await pgliteDb.insert(schema.societes).values({
        id: "b2",
        nom: "Partial Brand",
        logoUrl: null,
        faviconUrl: null,
        couleurPrimaire: null,
        modifieLe: new Date(),
      })

      const branding = await getSocieteBranding()
      expect(branding).toMatchObject({
        id: "b2",
        nom: "Partial Brand",
        nomExpediteurEmail: "Notification",
        domaineEmail: "noreply@exemple.ma",
      })
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

    it("throws when no allowed fields are provided", async () => {
      await expect(
        updateSociete({ unknownField: "value" }, actorId)
      ).rejects.toThrow("Aucune donnée à mettre à jour")
    })

    it("only updates allowed fields", async () => {
      await updateSociete(
        { nom: "Updated", unknownField: "should be ignored" } as any,
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
