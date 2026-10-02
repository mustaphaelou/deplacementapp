import { describe, it, expect, beforeAll, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
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
import { handleServiceError, NumeroCollisionError } from "../errors"

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
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)

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

  async function createDraftDemande(
    actorId = employeeId,
    overrides: Record<string, unknown> = {}
  ) {
    return createDraft(
      { ...sampleData, ...overrides },
      { id: actorId, role: "EMPLOYEE" }
    )
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
        })
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
        })
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
        })
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
        })
      ).rejects.toThrow("Action non autorisee")
    })

    // CONTEXT.md — Decision: APPROVED, REJECTED and WITHDRAWN are terminal.
    // The frozen row must keep the Etape where the terminal Decision was
    // recorded (no move to a new stage), and no role may transition it again.
    it("a REJECTED demande freezes at the rejecting Etape and cannot be resubmitted", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      const rejected = await executeTransition({
        demandeId: demande.id,
        action: "rejeter",
        actor: { id: managerId, role: "MANAGER" },
        comment: "Budget indisponible",
      })
      expect(rejected.etape).toBe("MANAGER_REVIEW")
      expect(rejected.decision).toBe("REJECTED")
      expect(rejected.assigneAId).toBe(managerId)

      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "submit",
          actor: { id: employeeId, role: "EMPLOYEE" },
        })
      ).rejects.toThrow("Action non autorisee")
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "approuver",
          actor: { id: managerId, role: "MANAGER" },
        })
      ).rejects.toThrow("Action non autorisee")
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "retirer",
          actor: { id: employeeId, role: "EMPLOYEE" },
        })
      ).rejects.toThrow("Action non autorisee")
    })

    it("a finally-approved demande (FINAL + APPROVED) is frozen for every role", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      const finalDemande = await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: managerId, role: "MANAGER" },
      })
      expect(finalDemande.assigneAId).toBe(managerId)
      await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
      })
      const approved = await executeTransition({
        demandeId: demande.id,
        action: "approuver",
        actor: { id: directionId, role: "GENERAL_DIRECTION" },
      })
      expect(approved.etape).toBe("FINAL")
      expect(approved.decision).toBe("APPROVED")
      // Assignataire: the GENERAL_DIRECTION member who gave the final approval
      expect(approved.assigneAId).toBe(directionId)

      for (const attempt of [
        {
          action: "submit" as const,
          actor: { id: employeeId, role: "EMPLOYEE" as const },
        },
        {
          action: "retirer" as const,
          actor: { id: employeeId, role: "EMPLOYEE" as const },
        },
        {
          action: "approuver" as const,
          actor: { id: managerId, role: "MANAGER" as const },
        },
        {
          action: "rejeter" as const,
          actor: { id: financeAdminId, role: "FINANCE_ADMIN" as const },
        },
        {
          action: "approuver" as const,
          actor: { id: directionId, role: "GENERAL_DIRECTION" as const },
        },
      ]) {
        await expect(
          executeTransition({ demandeId: demande.id, ...attempt })
        ).rejects.toThrow("Action non autorisee")
      }
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
        })
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
        })
      ).rejects.toThrow()

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(2)
      expect(auditRows[0].action).toBe("CREATION")
      expect(auditRows[1].action).toBe("SOUMISSION")
    })

    it("persists the approver as Assignataire on a first approval", async () => {
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

      expect(updated.assigneAId).toBe(managerId)
    })

    it("persists the rejecter as Assignataire on a first rejection", async () => {
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
        comment: "Non justifie",
      })

      expect(updated.assigneAId).toBe(managerId)
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

    it("rolls back demande update and JournalAudit if Notification insert fails", async () => {
      await pgliteDb.execute(sql`
        CREATE OR REPLACE FUNCTION fail_notification_insert()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $body$ BEGIN RAISE EXCEPTION 'Simulated notification failure'; END; $body$;
      `)
      await pgliteDb.execute(sql`
        CREATE TRIGGER trg_fail_notification
        BEFORE INSERT ON notifications
        FOR EACH ROW EXECUTE FUNCTION fail_notification_insert();
      `)

      const demande = await createDraftDemande()

      try {
        await expect(
          executeTransition({
            demandeId: demande.id,
            action: "submit",
            actor: { id: employeeId, role: "EMPLOYEE" },
          })
        ).rejects.toThrow()
      } finally {
        await pgliteDb.execute(
          sql`DROP TRIGGER IF EXISTS trg_fail_notification ON notifications`
        )
        await pgliteDb.execute(
          sql`DROP FUNCTION IF EXISTS fail_notification_insert()`
        )
      }

      const [row] = await pgliteDb
        .select()
        .from(schema.demandesDeplacement)
        .where(eq(schema.demandesDeplacement.id, demande.id))
      expect(row.etape).toBe("DRAFT")
      expect(row.decision).toBe("PENDING")

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe("CREATION")
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

  // ─── executeTransition - actif filter ──────────────────────────────

  describe("executeTransition - actif filter (mixed actif values)", () => {
    let inactiveManagerId: string
    let inactiveFinanceAdminId: string

    beforeAll(async () => {
      inactiveManagerId = crypto.randomUUID()
      inactiveFinanceAdminId = crypto.randomUUID()

      await pgliteDb.insert(schema.utilisateurs).values([
        {
          id: inactiveManagerId,
          email: "inactive-manager@test.com",
          nom: "Inactif",
          prenom: "Manager",
          poste: "Manager",
          role: "MANAGER",
          departementId,
          societeId,
          actif: false,
          modifieLe: new Date(),
        },
        {
          id: inactiveFinanceAdminId,
          email: "inactive-finance@test.com",
          nom: "Inactif",
          prenom: "Finance",
          poste: "Comptable",
          role: "FINANCE_ADMIN",
          departementId,
          societeId,
          actif: false,
          modifieLe: new Date(),
        },
      ])
    })

    it("submit writes notifications only to active MANAGER recipients", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))

      const recipientIds = notifRows.map((r) => r.utilisateurId)
      expect(recipientIds).toContain(managerId)
      expect(recipientIds).not.toContain(inactiveManagerId)
      expect(recipientIds).not.toContain(inactiveFinanceAdminId)
    })

    it("manager approval writes notifications only to active FINANCE_ADMIN recipients", async () => {
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

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))

      const recipientIds = notifRows.map((r) => r.utilisateurId)
      expect(recipientIds).toContain(managerId)
      expect(recipientIds).toContain(financeAdminId)
      expect(recipientIds).not.toContain(inactiveManagerId)
      expect(recipientIds).not.toContain(inactiveFinanceAdminId)
    })
  })
  // ─── numero collision — a named refusal, not a bare 500 (#291) ───

  describe("numero collision", () => {
    async function rowCount(): Promise<number> {
      const rows = await pgliteDb
        .select({ id: schema.demandesDeplacement.id })
        .from(schema.demandesDeplacement)
      return rows.length
    }

    function numeroFor(counter: number): string {
      return `DD-${new Date().getFullYear()}-${String(counter).padStart(4, "0")}`
    }

    function rawRow(numero: string) {
      return {
        id: crypto.randomUUID(),
        numero,
        employeId: employeeId,
        employeNom: "Dupont",
        employePrenom: "Jean",
        employePoste: "Developpeur",
        employeDepartement: "Test Departement",
        motif: "[]",
        dateDepart: new Date("2025-07-01"),
        dateRetour: new Date("2025-07-03"),
        destination: "Casablanca",
        typeTransport: "AVION" as const,
        modifieLe: new Date(),
      }
    }

    /**
     * Occupy the numéro the NEXT creation is about to allocate, without
     * mocking anything: the counter reads `count()`, so filling the row the
     * count points past and then removing a different row puts the allocator
     * back onto an occupied numéro. The database really refuses the write.
     */
    async function occupyNextNumero(): Promise<string> {
      const filler = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      const occupied = numeroFor(Number(filler.numero.split("-")[2]) + 1)
      await pgliteDb
        .insert(schema.demandesDeplacement)
        .values(rawRow(occupied))
      await pgliteDb
        .delete(schema.demandesDeplacement)
        .where(eq(schema.demandesDeplacement.id, filler.id))
      return occupied
    }

    it("carries a numeric status and a sentence that names the collision", () => {
      const refusal = new NumeroCollisionError()
      expect(refusal).toBeInstanceOf(Error)
      expect(refusal.name).toBe("NumeroCollisionError")
      expect(refusal.status).toBe(409)
      expect(refusal.message).toBe("Le numéro de la demande est déjà utilisé")
    })

    it("answers a collided creation with its own status and sentence, at the handler", async () => {
      const occupied = await occupyNextNumero()
      let thrown: unknown
      try {
        await createDraft(sampleData, { id: employeeId, role: "EMPLOYEE" })
      } catch (e) {
        thrown = e
      } finally {
        await pgliteDb
          .delete(schema.demandesDeplacement)
          .where(eq(schema.demandesDeplacement.numero, occupied))
      }

      expect(thrown).toBeInstanceOf(NumeroCollisionError)

      const res = handleServiceError(thrown)
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "Le numéro de la demande est déjà utilisé",
      })
    })

    it("refuses a collided submission the same way", async () => {
      const occupied = await occupyNextNumero()
      let thrown: unknown
      try {
        await createAndSubmit(sampleData, { id: employeeId, role: "EMPLOYEE" })
      } catch (e) {
        thrown = e
      } finally {
        await pgliteDb
          .delete(schema.demandesDeplacement)
          .where(eq(schema.demandesDeplacement.numero, occupied))
      }

      expect(thrown).toBeInstanceOf(NumeroCollisionError)
      expect(handleServiceError(thrown).status).toBe(409)
    })

    it("leaves no trace of a refused creation: no row, no audit, no retry", async () => {
      const occupied = await occupyNextNumero()
      const rowsBefore = await rowCount()
      const auditBefore = await pgliteDb.select().from(schema.journalAudit)

      try {
        await expect(
          createDraft(sampleData, { id: employeeId, role: "EMPLOYEE" })
        ).rejects.toBeInstanceOf(NumeroCollisionError)
        expect(await rowCount()).toBe(rowsBefore)
        const auditAfter = await pgliteDb.select().from(schema.journalAudit)
        expect(auditAfter).toHaveLength(auditBefore.length)
      } finally {
        await pgliteDb
          .delete(schema.demandesDeplacement)
          .where(eq(schema.demandesDeplacement.numero, occupied))
      }
    })

    it("does NOT swallow an unrelated database error into the collision refusal", async () => {
      await pgliteDb.execute(sql`
        CREATE OR REPLACE FUNCTION fail_demande_insert()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $body$ BEGIN RAISE EXCEPTION 'Simulated demande insert failure'; END; $body$;
      `)
      await pgliteDb.execute(sql`
        CREATE TRIGGER trg_fail_demande_insert
        BEFORE INSERT ON demandes_deplacement
        FOR EACH ROW EXECUTE FUNCTION fail_demande_insert();
      `)

      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
      let thrown: unknown
      try {
        await createDraft(sampleData, { id: employeeId, role: "EMPLOYEE" })
      } catch (e) {
        thrown = e
      } finally {
        await pgliteDb.execute(
          sql`DROP TRIGGER IF EXISTS trg_fail_demande_insert ON demandes_deplacement`
        )
        await pgliteDb.execute(
          sql`DROP FUNCTION IF EXISTS fail_demande_insert()`
        )
      }

      // The simulated failure is NOT a 23505, so it must reach the caller as
      // itself — never as the collision refusal.
      expect(thrown).toBeTruthy()
      expect(thrown).not.toBeInstanceOf(NumeroCollisionError)
      const chain: string[] = []
      for (let cause: unknown = thrown; cause; cause = (cause as Error).cause) {
        chain.push(String((cause as Error).message))
      }
      expect(chain.join(" | ")).toContain("Simulated demande insert failure")
      expect(chain.join(" | ")).not.toContain("numéro de la demande")

      const res = handleServiceError(thrown)
      expect(res.status).toBe(500)
      await expect(res.json()).resolves.toEqual({ error: "Erreur interne" })
      consoleError.mockRestore()
    })

    it("creates exactly as before when the numéro does not collide", async () => {
      const before = await rowCount()
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(await rowCount()).toBe(before + 1)
      expect(demande.numero).toBe(numeroFor(before + 1))
      expect(demande.etape).toBe("DRAFT")
      expect(demande.decision).toBe("PENDING")
      expect(demande.employeNom).toBe("Dupont")
      expect(Number(demande.totalEstime)).toBe(4600)

      const rows = await pgliteDb
        .select()
        .from(schema.demandesDeplacement)
        .where(eq(schema.demandesDeplacement.id, demande.id))
      expect(rows).toHaveLength(1)

      const auditRows = await pgliteDb
        .select()
        .from(schema.journalAudit)
        .where(eq(schema.journalAudit.entiteId, demande.id))
      expect(auditRows).toHaveLength(1)
      expect(auditRows[0].action).toBe("CREATION")

      const notifRows = await pgliteDb
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.demandeId, demande.id))
      expect(notifRows).toHaveLength(0)
    })

    it("keeps the year prefix from the clock", async () => {
      vi.useFakeTimers({ toFake: ["Date"] })
      try {
        vi.setSystemTime(new Date("2031-03-04T12:00:00Z"))
        const demande = await createDraft(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        expect(demande.numero).toMatch(/^DD-2031-\d{4}$/)
      } finally {
        vi.useRealTimers()
      }
    })

    it("keeps the padding at 4 digits", async () => {
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      expect(demande.numero).toMatch(/^DD-\d{4}-\d{4}$/)
    })

    it("keeps the counter global: a soft-deleted DemandeDeplacement still consumes its numero", async () => {
      const before = await rowCount()
      const deleted = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, deleted.id))

      // The soft-deleted row is still a row: the count that feeds the numéro
      // counts it, so its numéro is consumed and never handed out again.
      const afterSoftDelete = await rowCount()
      expect(afterSoftDelete).toBe(before + 1)

      const next = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      expect(next.numero).toBe(numeroFor(afterSoftDelete + 1))
      expect(next.numero).not.toBe(deleted.numero)
    })
  })

  // ─── The creation path asks the pipeline where it starts (#293) ───────────
  //
  // `etatCreation` and `readFile` are pulled in here rather than at the top of
  // the file: this block is appended, and a shared import block is where a
  // concurrent edit would collide.

  describe("the creation path reads its opening state from the pipeline", () => {
    it("writes a draft at the pipeline's own answer for the creating Role, not at a literal", async () => {
      const { etatCreation } = await import("../workflow")
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const attendu = etatCreation("EMPLOYEE", false)
      expect(demande.etape).toBe(attendu.etape)
      expect(demande.decision).toBe(attendu.decision)
    })

    // The assertion above moves with the pipeline's answer, so it cannot fail
    // on its own: if the opening Etape changed, the row and the call would
    // change together. This one is read from the pipeline's own table instead,
    // so a drifted opening state fails here rather than passing quietly.
    it("writes a draft at the Etape the submit effect leaves from, with the pending Decision", async () => {
      const { TRANSITION_EFFECTS, isPendingDecision } = await import(
        "../workflow"
      )
      const demande = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const effetSoumission = TRANSITION_EFFECTS.find(
        (e) => e.action === "submit"
      )
      expect(effetSoumission).toBeDefined()
      expect(demande.etape).toBe(effetSoumission!.from)
      // No cast: the row's Decision is the pipeline's union, read off the
      // schema's inferred row (#295).
      expect(isPendingDecision(demande.decision)).toBe(true)
    })

    it("writes a submission at the pipeline's own answer for the creating Role, not at a literal", async () => {
      const { etatCreation } = await import("../workflow")
      const demande = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })

      const attendu = etatCreation("EMPLOYEE", true)
      expect(demande.etape).toBe(attendu.etape)
      expect(demande.decision).toBe(attendu.decision)
    })

    it("stamps the modification timestamp once on both paths, and never through the pipeline", async () => {
      const { etatCreation } = await import("../workflow")
      const avant = new Date()
      const draft = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      const soumis = await createAndSubmit(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      const apres = new Date()

      // The stamp belongs to the creation, so the pipeline's field set never
      // carries it, on either path. Both rows are stamped once, inside the
      // window of the creation itself.
      expect(etatCreation("EMPLOYEE", false).champs).not.toHaveProperty(
        "modifieLe"
      )
      expect(etatCreation("EMPLOYEE", true).champs).not.toHaveProperty(
        "modifieLe"
      )
      for (const row of [draft, soumis]) {
        expect(row.modifieLe.getTime()).toBeGreaterThanOrEqual(avant.getTime())
        expect(row.modifieLe.getTime()).toBeLessThanOrEqual(apres.getTime())
      }
    })

    // A second stamping of modifieLe would still land inside the window above,
    // so the pin that makes a re-stamp red is structural: the creation
    // function's own source must carry the field exactly once.
    it("stamps modifieLe exactly once in the creation function, on both paths", async () => {
      const { readFile } = await import("node:fs/promises")
      const source = await readFile(
        new URL("./mutations.ts", import.meta.url),
        "utf8"
      )
      const start = source.indexOf("async function createDemande(")
      const end = source.indexOf("export async function createDraft(")
      // The anchors are asserted BEFORE slicing: `indexOf` answers -1 when an
      // anchor is gone, and a -1 would silently slice the wrong region.
      expect(start).toBeGreaterThan(-1)
      expect(end).toBeGreaterThan(start)

      const corps = source.slice(start, end)
      expect(corps.match(/modifieLe/g)).toHaveLength(1)
      expect(corps).toContain("modifieLe: new Date()")
    })

    it("keeps every Etape and Decision literal out of the creation function", async () => {
      const { readFile } = await import("node:fs/promises")
      const source = await readFile(
        new URL("./mutations.ts", import.meta.url),
        "utf8"
      )
      const start = source.indexOf("async function createDemande(")
      const end = source.indexOf("export async function createDraft(")
      expect(start).toBeGreaterThan(-1)
      expect(end).toBeGreaterThan(start)

      const corps = source.slice(start, end)
      for (const etape of [
        "DRAFT",
        "MANAGER_REVIEW",
        "FINANCE_REVIEW",
        "DIRECTION_REVIEW",
        "FINAL",
      ]) {
        expect(corps, etape).not.toContain(`"${etape}"`)
      }
      for (const decision of ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]) {
        expect(corps, decision).not.toContain(`"${decision}"`)
      }
      // The creation path must not build a transition of its own either:
      // submitting at creation is the pipeline's business, not this caller's.
      expect(corps).not.toContain("buildTransition")
      expect(corps).toContain("etatCreation(actor.role, submit)")
    })
  })
})
