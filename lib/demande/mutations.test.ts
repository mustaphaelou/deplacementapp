import { describe, it, expect, beforeAll, vi } from "vitest"
import { eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import * as dbModule from "../../db"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import {
  createDraft,
  createAndSubmit,
  executeTransition,
  recordDocument,
} from "./mutations"

const TIMEOUT = 30_000

describe("DemandeDeplacement mutations (PGLite)", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let employeeId: string
  let managerId: string
  let financeAdminId: string
  let directionId: string
  let societeId: string
  let departementId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb)

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    employeeId = crypto.randomUUID()
    managerId = crypto.randomUUID()
    financeAdminId = crypto.randomUUID()
    directionId = crypto.randomUUID()

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

    await pgliteDb.insert(schema.utilisateurs).values([
      {
        id: employeeId,
        email: "employee@test.com",
        nom: "Dupont",
        prenom: "Jean",
        poste: "Developpeur",
        role: "EMPLOYEE",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: managerId,
        email: "manager@test.com",
        nom: "Martin",
        prenom: "Sophie",
        poste: "Chef d'equipe",
        role: "MANAGER",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: financeAdminId,
        email: "finance@test.com",
        nom: "Bernard",
        prenom: "Pierre",
        poste: "Comptable",
        role: "FINANCE_ADMIN",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
      {
        id: directionId,
        email: "direction@test.com",
        nom: "Petit",
        prenom: "Marie",
        poste: "Directrice",
        role: "GENERAL_DIRECTION",
        departementId,
        societeId,
        actif: true,
        modifieLe: new Date(),
      },
    ])
  })

  const sampleData = {
    motif: ["mission_client", "formation"],
    dateDepart: "2025-07-01",
    dateRetour: "2025-07-03",
    destination: "Casablanca",
    typeTransport: "AVION" as const,
    fraisTransport: "1500",
    fraisHebergement: "2000",
    fraisRepas: "800",
    fraisDivers: "300",
    avanceRequise: true,
    montantAvance: "2000",
    description: "Mission client a Casablanca",
  }

  // ─── createDraft ──────────────────────────────────────────────────

  describe("createDraft", () => {
    it("persists employee snapshot fields", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.employeId).toBe(employeeId)
      expect(demande.employeNom).toBe("Dupont")
      expect(demande.employePrenom).toBe("Jean")
      expect(demande.employePoste).toBe("Developpeur")
      expect(demande.employeDepartement).toBe("Test Departement")
    })

    it("computes EstimationFrais total", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(Number(demande.totalEstime)).toBe(4600)
      expect(Number(demande.fraisTransport)).toBe(1500)
      expect(Number(demande.fraisHebergement)).toBe(2000)
      expect(Number(demande.fraisRepas)).toBe(800)
      expect(Number(demande.fraisDivers)).toBe(300)
    })

    it("serializes Motif as JSON array", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const parsed = JSON.parse(demande.motif)
      expect(parsed).toEqual(["mission_client", "formation"])
    })

    it("generates a numero", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.numero).toMatch(/^DD-\d{4}-/)
    })

    it("leaves the demande at DRAFT with PENDING decision", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.etape).toBe("DRAFT")
      expect(demande.decision).toBe("PENDING")
    })

    it("returns the honest persisted DemandeDeplacement row", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande).not.toHaveProperty("employe")
      expect(demande).not.toHaveProperty("vehicule")
      expect(demande).toHaveProperty("id")
      expect(demande).toHaveProperty("etape")
    })

    it("creates a JournalAudit entry for CREATION", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe("CREATION")
      expect(auditRows[0].utilisateurId).toBe(employeeId)
    })

    it("does NOT create Notification rows for a draft", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows).toHaveLength(0)
    })
  })

  // ─── createAndSubmit ───────────────────────────────────────────────

  describe("createAndSubmit", () => {
    it("advances to MANAGER_REVIEW with PENDING decision", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.etape).toBe("MANAGER_REVIEW")
      expect(demande.decision).toBe("PENDING")
    })

    it("persists snapshot fields, total, motif, and numero", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.employeNom).toBe("Dupont")
      expect(Number(demande.totalEstime)).toBe(4600)
      expect(JSON.parse(demande.motif)).toEqual(["mission_client", "formation"])
      expect(demande.numero).toMatch(/^DD-\d{4}-/)
    })

    it("creates JournalAudit entry for SOUMISSION", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe("SOUMISSION")
    })

    it("creates Notification rows for DEMANDE_SOUMISE", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows.length).toBeGreaterThan(0)
    })

    it("returns the honest persisted DemandeDeplacement row", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande).not.toHaveProperty("employe")
      expect(demande.id).toBeTruthy()
    })

    it("sets soumiseLe timestamp", async () => {
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(demande.soumiseLe).toBeTruthy()
    })
  })

  // ─── executeTransition ─────────────────────────────────────────────

  describe("executeTransition - guards", () => {
    async function createDraftDemande(
      actorId = employeeId,
      overrides: Record<string, unknown> = {},
    ) {
      const demande = await createDraft(
        { ...sampleData, ...overrides },
        { id: actorId, role: "EMPLOYEE" },
      )
      return demande
    }

    it("EMPLOYEE can submit from DRAFT", async () => {
      const demande = await createDraftDemande()
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      expect(updated.etape).toBe("MANAGER_REVIEW")
      expect(updated.decision).toBe("PENDING")
    })

    it("non-owner cannot submit", async () => {
      const demande = await createDraftDemande()
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "submit",
          actor: { id: managerId, role: "EMPLOYEE" },
        }),
      ).rejects.toThrow("Seul le proprietaire peut soumettre")
    })

    it("EMPLOYEE can withdraw from DRAFT", async () => {
      const demande = await createDraftDemande()
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "retirer",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      expect(updated.decision).toBe("WITHDRAWN")
    })

    it("non-owner cannot withdraw", async () => {
      const demande = await createDraftDemande()
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "retirer",
          actor: { id: managerId, role: "MANAGER" },
        }),
      ).rejects.toThrow("Seul le proprietaire peut retirer")
    })

    it("MANAGER can approve at MANAGER_REVIEW", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      expect(updated.etape).toBe("FINANCE_REVIEW")
      expect(updated.decision).toBe("PENDING")
    })

    it("MANAGER can reject at MANAGER_REVIEW", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "rejeter",
        actor: { id: managerId, role: "MANAGER" },
        comment: "Fonds insuffisants",
      })
      expect(updated.decision).toBe("REJECTED")
      expect(updated.commentaireManager).toBe("Fonds insuffisants")
    })

    it("EMPLOYEE cannot approve at MANAGER_REVIEW", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "approuver",
          actor: { id: employeeId, role: "EMPLOYEE" },
        }),
      ).rejects.toThrow("Action non autorisee")
    })

    it("FINANCE_ADMIN can approve at FINANCE_REVIEW", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
      })
      expect(updated.etape).toBe("DIRECTION_REVIEW")
    })

    it("FINANCE_ADMIN can reject at FINANCE_REVIEW", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "rejeter",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
        comment: "Budget epuise",
      })
      expect(updated.decision).toBe("REJECTED")
      expect(updated.commentaireFinance).toBe("Budget epuise")
    })

    it("GENERAL_DIRECTION can approve at DIRECTION_REVIEW to terminal", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
      })
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: directionId, role: "GENERAL_DIRECTION" },
      })
      expect(updated.etape).toBe("FINAL")
      expect(updated.decision).toBe("APPROVED")
    })

    it("terminal DECISION blocks all further transitions", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "retirer",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "submit",
          actor: { id: employeeId, role: "EMPLOYEE" },
        }),
      ).rejects.toThrow("Action non autorisee")
    })

    it("FINAL stage blocks all transitions", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
      })
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: directionId, role: "GENERAL_DIRECTION" },
      })
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "approuver",
          actor: { id: directionId, role: "GENERAL_DIRECTION" },
        }),
      ).rejects.toThrow("Action non autorisee")
    })

    it("returns the honest persisted DemandeDeplacement row", async () => {
      const demande = await createDraftDemande()
      const updated = await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      expect(updated).not.toHaveProperty("employe")
      expect(updated).not.toHaveProperty("vehicule")
    })
  })

  // ─── executeTransition - side effects ─────────────────────────────

  describe("executeTransition - side effects", () => {
    async function createDraftDemande(actorId = employeeId) {
      return createDraft(sampleData, { id: actorId, role: "EMPLOYEE" })
    }

    it("committed submit writes JournalAudit + Notification rows", async () => {
      const demande = await createDraftDemande()

      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(2)
      expect(auditRows[1].action).toBe("SOUMISSION")

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows.length).toBeGreaterThan(0)
    })

    it("committed approval writes JournalAudit + Notification rows", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })

      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(3)
      expect(auditRows.map((r) => r.action)).toContain("APPROBATION_MANAGER")

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows.length).toBeGreaterThan(0)
    })

    it("failed transition writes nothing (no JournalAudit)", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })

      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "submit",
          actor: { id: managerId, role: "MANAGER" },
        }),
      ).rejects.toThrow()

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(2)
      expect(auditRows[0].action).toBe("CREATION")
      expect(auditRows[1].action).toBe("SOUMISSION")
    })

    it("committed rejection writes JournalAudit (REJET) + Notification", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })

      await executeTransition({
        demandeId: demande.id,
        action: "rejeter",
        actor: { id: managerId, role: "MANAGER" },
        comment: "Non justifie",
      })

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(3)
      expect(auditRows[2].action).toBe("REJET")

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows.length).toBeGreaterThan(0)
    })
  })

  // ─── recordDocument ──────────────────────────────────────────────

  describe("recordDocument", () => {
    it("persists a Document row", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const doc = await recordDocument(demande.id, {
        type: "application/pdf",
        chemin: "recu/DD-2025-0001.pdf",
      })

      expect(doc.demandeId).toBe(demande.id)
      expect(doc.type).toBe("application/pdf")
      expect(doc.chemin).toBe("recu/DD-2025-0001.pdf")
      expect(doc.id).toBeTruthy()
      expect(doc.creeLe).toBeTruthy()

      const rows = await pgliteDb
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, doc.id))
      expect(rows).toHaveLength(1)
    })

    it("returns the honest Document row", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const doc = await recordDocument(demande.id, {
        type: "image/png",
        chemin: "photos/facture.png",
      })

      expect(doc).not.toHaveProperty("demande")
    })
  })
})
