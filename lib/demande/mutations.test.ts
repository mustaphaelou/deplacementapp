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
import { checkTransition } from "../workflow"
import type { Actor } from "../demande-types"

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

    // WRONG_ROLE: the seat is read before the Decision, and at MANAGER_REVIEW the
    // seat belongs to the MANAGER. The refusal names the Etape and the Role's seat
    // at it — never the Utilisateur's standing, because the EMPLOYEE here is
    // perfectly admissible elsewhere (#300).
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
      ).rejects.toThrow("Aucune transition n'est possible a cette etape pour ce role")
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

    // TERMINAL: the Decision WITHDRAWN is already recorded, and the seat check has
    // already passed — this is the owner refusing their OWN draft. The old answer
    // was « Action non autorisee », which was doubly false: they may withdraw at
    // DRAFT, and it has already been done (#300).
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
      ).rejects.toThrow("La demande a deja ete decidee")
    })

    // CONTEXT.md — Decision: APPROVED, REJECTED and WITHDRAWN are terminal.
    // The frozen row must keep the Etape where the terminal Decision was
    // recorded (no move to a new stage), and no role may transition it again.
    // Three attempts, THREE different (Role, action) pairs, and all three reach the
    // SAME reason — which is the point of naming reasons. The row is frozen at
    // MANAGER_REVIEW with Decision REJECTED, and the guard's order is seat → Decision
    // → owner/action → effect → role: the seat check passes for each of them on its
    // own terms (an EMPLOYEE owns a DRAFT, a MANAGER holds MANAGER_REVIEW, and
    // ownership is never even reached). So none is refused for who is asking. The
    // MANAGER at line 509 is exactly the reader the ticket names: authorised, and told
    // the DemandeDeplacement is decided (#300).
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
      ).rejects.toThrow("La demande a deja ete decidee")
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "approuver",
          actor: { id: managerId, role: "MANAGER" },
        })
      ).rejects.toThrow("La demande a deja ete decidee")
      await expect(
        executeTransition({
          demandeId: demande.id,
          action: "retirer",
          actor: { id: employeeId, role: "EMPLOYEE" },
        })
      ).rejects.toThrow("La demande a deja ete decidee")
    })

    // WRONG_ROLE, and the reason is the Etape rather than the Decision. The row sits at
    // FINAL, where NO Role holds a seat, and the guard reads the seat BEFORE the
    // Decision — so the APPROVED decision never even becomes the reason, for any of
    // these five Roles. The last attempt is the tuple the ticket names: the
    // GENERAL_DIRECTION who just gave the final approval is told that no transition
    // is possible at this Etape for this Role, not that they are not allowed (#300).
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
        ).rejects.toThrow("Aucune transition n'est possible a cette etape pour ce role")
      }
    })

    // WRONG_ROLE again, for the same reason as the case above: the row is at FINAL, so
    // the missing seat is read before the APPROVED decision. This is the shortest
    // form of the ticket's complaint — the GENERAL_DIRECTION who just approved it
    // presses « Approuver » once more and is refused for the Etape, with the sentence
    // that says so (#300).
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
      ).rejects.toThrow("Aucune transition n'est possible a cette etape pour ce role")
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

  // ─── Chaque raison, jusqu'a la reponse (#300) ─────────────────────────────
  //
  // The criterion: every reason the guard can produce is driven through the real
  // transition writer AND through the settled error handler, and the RESPONSE the
  // Utilisateur receives is asserted AT THE HANDLER — both the status code and the
  // body — not one step past it.
  //
  // Each case builds a real row and presses a real button, so the reason produced
  // is the guard's own verdict rather than a restatement of it. `checkTransition`
  // is called beside each one to say WHICH reason the fixture reaches: a case whose
  // premise silently changed (a seat moving, an Etape renaming) then fails as a
  // mislabelled premise instead of quietly passing on a different reason's message.
  describe("chaque raison se nomme jusqu'a la reponse du Utilisateur", () => {
    /** Drive the writer, catch what it raised, and answer it at the handler. */
    async function reponseAuUtilisateur(
      demandeId: string,
      action: "submit" | "approuver" | "rejeter" | "retirer",
      actor: { id: string; role: Actor["role"] }
    ): Promise<{ status: number; body: { error: string } }> {
      let thrown: unknown
      try {
        await executeTransition({ demandeId, action, actor })
      } catch (e) {
        thrown = e
      }

      expect(thrown, "le writer a accepte la transition").toBeInstanceOf(Error)
      const res = handleServiceError(thrown)
      const body = (await res.json()) as { error: string }
      return { status: res.status, body }
    }

    // NOT_OWNER. The second Utilisateur presses « Soumettre » on the first's DRAFT.
    it("dit au non-proprietaire qu'il ne peut pas soumettre, avec 403", async () => {
      const demande = await createDraftDemande()
      expect(
        checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", false)
      ).toEqual({ ok: false, reason: "NOT_OWNER" })

      const { status, body } = await reponseAuUtilisateur(demande.id, "submit", {
        id: managerId,
        role: "EMPLOYEE",
      })

      expect(status).toBe(403)
      expect(body).toEqual({ error: "Seul le proprietaire peut soumettre la demande" })
    })

    // The second ownership sentence, driven at the handler too — the two are
    // separate strings and the table has to keep them apart.
    it("dit au non-proprietaire qu'il ne peut pas retirer, avec 403", async () => {
      const demande = await createDraftDemande()
      expect(
        checkTransition("EMPLOYEE", "DRAFT", "retirer", "PENDING", false)
      ).toEqual({ ok: false, reason: "NOT_OWNER" })

      const { status, body } = await reponseAuUtilisateur(demande.id, "retirer", {
        id: managerId,
        role: "EMPLOYEE",
      })

      expect(status).toBe(403)
      expect(body).toEqual({ error: "Seul le proprietaire peut retirer la demande" })
    })

    // WRONG_ROLE at a review Etape: an EMPLOYEE presses « Approuver » where the
    // seat belongs to the MANAGER. 403 — this one IS about who is asking.
    it("nomme l'Etape et le siege quand le Role n'a pas de siege la, avec 403", async () => {
      const demande = await createDraftDemande()
      await executeTransition({
        demandeId: demande.id,
        action: "submit",
        actor: { id: employeeId, role: "EMPLOYEE" },
      })
      expect(
        checkTransition("EMPLOYEE", "MANAGER_REVIEW", "approuver", "PENDING", true)
      ).toEqual({ ok: false, reason: "WRONG_ROLE" })

      const { status, body } = await reponseAuUtilisateur(
        demande.id,
        "approuver",
        { id: employeeId, role: "EMPLOYEE" }
      )

      expect(status).toBe(403)
      expect(body).toEqual({
        error: "Aucune transition n'est possible a cette etape pour ce role",
      })
    })

    // WRONG_ROLE at the terminal Etape — the tuple the ticket names. The
    // GENERAL_DIRECTION who JUST approved presses « Approuver » again, and is told
    // the Etape admits no transition for this Role rather than that they are not
    // allowed. 403, because it is still the Role's seat at the Etape that is the
    // claim, and it is true there.
    it("nomme l'Etape au Role qui vient d'approuver, a FINAL", async () => {
      const demande = await createDraftDemande()
      for (const [action, actor] of [
        ["submit", { id: employeeId, role: "EMPLOYEE" as const }],
        ["approuver", { id: managerId, role: "MANAGER" as const }],
        ["approuver", { id: financeAdminId, role: "FINANCE_ADMIN" as const }],
        ["approuver", { id: directionId, role: "GENERAL_DIRECTION" as const }],
      ] as const) {
        await executeTransition({ demandeId: demande.id, action, actor })
      }
      expect(
        checkTransition("GENERAL_DIRECTION", "FINAL", "approuver", "APPROVED", true)
      ).toEqual({ ok: false, reason: "WRONG_ROLE" })

      const { status, body } = await reponseAuUtilisateur(
        demande.id,
        "approuver",
        { id: directionId, role: "GENERAL_DIRECTION" }
      )

      expect(status).toBe(403)
      expect(body).toEqual({
        error: "Aucune transition n'est possible a cette etape pour ce role",
      })
    })

    // TERMINAL at a review Etape — the case a Utilisateur actually meets, and the
    // one the ticket's complaint is about. The MANAGER is AUTHORISED and is told
    // the DemandeDeplacement is decided. 422, not 403: nothing about « you may not ».
    it("dit au MANAGER que la demande est decidee, avec 422", async () => {
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
        comment: "Budget indisponible",
      })
      expect(
        checkTransition("MANAGER", "MANAGER_REVIEW", "approuver", "REJECTED", false)
      ).toEqual({ ok: false, reason: "TERMINAL" })

      const { status, body } = await reponseAuUtilisateur(
        demande.id,
        "approuver",
        { id: managerId, role: "MANAGER" }
      )

      expect(status).toBe(422)
      expect(body).toEqual({ error: "La demande a deja ete decidee" })
    })

    // NO_EFFECT. The EMPLOYEE presses « Approuver » on their own DRAFT, where no
    // such action exists. They are admissible there — for their own actions — so
    // this cannot borrow the permission code: 422.
    it("dit que l'action n'existe pas a cette Etape, avec 422", async () => {
      const demande = await createDraftDemande()
      expect(
        checkTransition("EMPLOYEE", "DRAFT", "approuver", "PENDING", true)
      ).toEqual({ ok: false, reason: "NO_EFFECT" })

      const { status, body } = await reponseAuUtilisateur(
        demande.id,
        "approuver",
        { id: employeeId, role: "EMPLOYEE" }
      )

      expect(status).toBe(422)
      expect(body).toEqual({ error: "Cette action n'existe pas a cette etape" })
    })

    // The wire change, stated as a test. The three reasons that used to answer 403
    // now answer 422, and none of the four answers the old generic sentence any
    // more. Read off the responses produced here — NOT a restatement of the
    // expectations above, so a case above that changed its code fails this too.
    //
    // Both calls target the SAME row on purpose: the difference between the two
    // answers is then provably the Role asking and not the DemandeDeplacement,
    // which is exactly the distinction the ticket is about.
    it("distingue « qui demande » de « la demande » sur une seule ligne", async () => {
      const autre = await createDraftDemande()

      // A MANAGER asking: NOT_OWNER — 403, about who is asking.
      const quiDemande = await reponseAuUtilisateur(autre.id, "submit", {
        id: managerId,
        role: "EMPLOYEE",
      })
      // The owner asking about an action that does not exist here: NO_EFFECT — 422,
      // about the DemandeDeplacement.
      const laDemande = await reponseAuUtilisateur(autre.id, "approuver", {
        id: employeeId,
        role: "EMPLOYEE",
      })

      expect(quiDemande.status).toBe(403)
      expect(laDemande.status).toBe(422)
      expect(quiDemande.body.error).not.toBe(laDemande.body.error)
      for (const { status, body } of [quiDemande, laDemande]) {
        expect([403, 422], body.error).toContain(status)
        expect(body.error).not.toBe("Action non autorisee")
      }
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

// ─── un numéro en collision est rejoué, pas refusé (#292) ───────────────
  //
  // Appended at the end of the file. Its helpers are declared here rather
  // than hoisted into the shared import block, so a concurrent edit of the
  // blocks above cannot collide.

  describe("un numéro en collision est rejoué, pas refusé (#292)", () => {
    const TABLE_ESPIONNEES = [
      "demandes_deplacement",
      "journal_audit",
      "notifications",
    ]

    function numeroPour(compteur: number): string {
      return `DD-${new Date().getFullYear()}-${String(compteur).padStart(4, "0")}`
    }

    async function compterLignes(): Promise<number> {
      const rows = await pgliteDb
        .select({ id: schema.demandesDeplacement.id })
        .from(schema.demandesDeplacement)
      return rows.length
    }

    function ligneBrute(numero: string) {
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
     * Occupy the numéro the NEXT creation is about to allocate, and leave the
     * counter still pointing at it. `generateNumero` reads `count()`, so
     * writing a raw row one above a real one and then removing the real one
     * moves the count without moving the numéro the allocator is about to
     * hand out. Nothing is mocked: the real unique index refuses the real
     * write, with the real SQLSTATE.
     *
     * The caller must call `liberer(occupe)` when it is done, or every later
     * test in this file reads a count one row too high.
     */
    async function occuperLeProchainNumero(): Promise<{
      occupe: string
      compteur: number
    }> {
      const remplacant = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      const occupe = numeroPour(Number(remplacant.numero.split("-")[2]) + 1)
      await pgliteDb
        .insert(schema.demandesDeplacement)
        .values(ligneBrute(occupe))
      await pgliteDb
        .delete(schema.demandesDeplacement)
        .where(eq(schema.demandesDeplacement.id, remplacant.id))
      return { occupe, compteur: await compterLignes() }
    }

    /**
     * Remove every row a test added, so the next test reads the same counter.
     *
     * The numéro is allocated from `count()`, so a test that adds rows and
     * removes only some of them leaves the count BELOW the highest numéro in
     * use — and the allocator then walks back onto an occupied numéro, which
     * looks like a collision and is not one. Every test here therefore hands
     * back all three: the occupant, the rival, and the DemandeDeplacement it
     * created.
     */
    async function liberer(...numeros: string[]): Promise<void> {
      for (const numero of numeros) {
        await pgliteDb
          .delete(schema.demandesDeplacement)
          .where(eq(schema.demandesDeplacement.numero, numero))
      }
    }

    /** The bound, read out of the source so this file cannot drift from it. */
    async function lireLaBorn(): Promise<number | null> {
      const { readFile } = await import("node:fs/promises")
      const source = await readFile(
        new URL("./mutations.ts", import.meta.url),
        "utf8"
      )
      const trouve = source.match(/const NUMERO_COLLISION_ATTEMPTS = (\d+)/)
      return trouve ? Number(trouve[1]) : null
    }

    /**
     * Count the transactions the creation opens, without changing what they
     * do: the real `db.transaction` runs inside the spy.
     */
    function surveillerTransactions() {
      const vrai = pgliteDb.transaction.bind(pgliteDb)
      let appels = 0
      const spy = vi
        .spyOn(pgliteDb, "transaction")
        .mockImplementation((async (...args: any[]) => {
          appels++
          return (vrai as any)(...args)
        }) as any)
      return { appels: () => appels, restaurer: () => spy.mockRestore() }
    }

    /**
     * A lost race, made real.
     *
     * The numéro the creation has just read stays occupied, and a rival
     * creation commits its own row before the first transaction opens — the
     * exact instant a concurrent Utilisateur would have won it. Nothing is
     * stubbed: the first write is refused by the real unique index, and the
     * retry lands only because it reads the counter again and finds it one
     * higher. A retry that reused the numéro just refused would collide again.
     *
     * The seam lives on this test file's own PGlite handle. The production
     * creation path has no hook of its own, and the happy path never needs
     * one.
     */
    function coursePerduee(numeroRival: string) {
      const vrai = pgliteDb.transaction.bind(pgliteDb)
      let rivalCommit = false
      let tentatives = 0
      const spy = vi
        .spyOn(pgliteDb, "transaction")
        .mockImplementation((async (...args: any[]) => {
          if (!rivalCommit) {
            rivalCommit = true
            await pgliteDb
              .insert(schema.demandesDeplacement)
              .values(ligneBrute(numeroRival))
          }
          tentatives++
          return (vrai as any)(...args)
        }) as any)
      return {
        tentatives: () => tentatives,
        restaurer: () => spy.mockRestore(),
      }
    }

    /**
     * A trigger that stamps the transaction each row was written in, keyed by
     * the DemandeDeplacement it belongs to. The database's own answer to
     * « were these written together? », not the shape of the code.
     */
    async function poserEspionDeTransaction(): Promise<void> {
      await pgliteDb.execute(sql`
        CREATE TABLE IF NOT EXISTS xid_espion (
          id serial primary key,
          moment text not null,
          xid text not null
        );
      `)
      await pgliteDb.execute(sql`
        CREATE OR REPLACE FUNCTION noter_xid() RETURNS TRIGGER LANGUAGE plpgsql
        AS $body$ BEGIN
          INSERT INTO xid_espion (moment, xid) VALUES (
            TG_TABLE_NAME || ':' || COALESCE(
              to_jsonb(NEW) ->> 'entiteId',
              to_jsonb(NEW) ->> 'demandeId',
              to_jsonb(NEW) ->> 'id'
            ),
            pg_current_xact_id()::text
          );
          RETURN NULL;
        END; $body$;
      `)
      for (const table of TABLE_ESPIONNEES) {
        await pgliteDb.execute(
          sql`DROP TRIGGER IF EXISTS trg_xid_espion ON ${sql.raw(table)}`
        )
        await pgliteDb.execute(sql`
          CREATE TRIGGER trg_xid_espion AFTER INSERT ON ${sql.raw(table)}
          FOR EACH ROW EXECUTE FUNCTION noter_xid();
        `)
      }
    }

    async function deposerEspionDeTransaction(): Promise<void> {
      for (const table of TABLE_ESPIONNEES) {
        await pgliteDb.execute(
          sql`DROP TRIGGER IF EXISTS trg_xid_espion ON ${sql.raw(table)}`
        )
      }
      await pgliteDb.execute(sql`DROP TABLE IF EXISTS xid_espion;`)
    }

    async function momentsDe(demandeId: string): Promise<string[]> {
      const result = (await pgliteDb.execute(
        sql`SELECT moment FROM xid_espion WHERE moment LIKE ${"%" + demandeId}`
      )) as unknown as { rows: { moment: string }[] }
      return result.rows.map((r) => r.moment)
    }

    async function transactionsDe(demandeId: string): Promise<string[]> {
      const result = (await pgliteDb.execute(
        sql`SELECT xid FROM xid_espion WHERE moment LIKE ${"%" + demandeId}`
      )) as unknown as { rows: { xid: string }[] }
      return result.rows.map((r) => r.xid)
    }

    /** How many transactions have ever written a row that stuck. */
    async function transactionsDistinctes(): Promise<string[]> {
      const result = (await pgliteDb.execute(
        sql`SELECT DISTINCT xid FROM xid_espion ORDER BY xid`
      )) as unknown as { rows: { xid: string }[] }
      return result.rows.map((r) => r.xid)
    }

    // ── une collision se résout sans refus ─────────────────────────────────

    it("rejoue toute la création et aboutit, avec un numéro unique qui n'appartient à personne d'autre", async () => {
      const { occupe, compteur } = await occuperLeProchainNumero()
      const lignesAvant = await compterLignes()
      const journalAvant = (
        await pgliteDb.select().from(schema.journalAudit)
      ).length
      const notifsAvant = (
        await pgliteDb.select().from(schema.notifications)
      ).length
      const course = coursePerduee(numeroPour(compteur + 500))
      let creee: string | undefined

      try {
        const demande = await createDraft(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        creee = demande.numero

        // The Utilisateur's DemandeDeplacement exists...
        const row = await pgliteDb
          .select()
          .from(schema.demandesDeplacement)
          .where(eq(schema.demandesDeplacement.id, demande.id))
        expect(row).toHaveLength(1)

        // ...with a numéro that is unique, correctly prefixed, correctly
        // padded, and nobody else's. It is one past the count the retry read:
        // reusing the numéro the database had just refused would collide
        // again, so this is only reachable by re-reading the counter.
        expect(demande.numero).toBe(numeroPour(compteur + 2))
        expect(demande.numero).not.toBe(occupe)
        expect(demande.numero).toMatch(/^DD-\d{4}-\d{4}$/)
        const titulaires = await pgliteDb
          .select({ numero: schema.demandesDeplacement.numero })
          .from(schema.demandesDeplacement)
        expect(
          titulaires.filter((r) => r.numero === demande.numero)
        ).toHaveLength(1)

        // One retry, and nothing of the refused attempt survived it: the rows
        // grew by the rival's and this one's, the journal by exactly this
        // creation's entry, and a draft notifies nobody.
        expect(course.tentatives()).toBe(2)
        expect(await compterLignes()).toBe(lignesAvant + 2)
        expect(
          (await pgliteDb.select().from(schema.journalAudit)).length
        ).toBe(journalAvant + 1)
        expect(
          (
            await pgliteDb
              .select()
              .from(schema.notifications)
              .where(eq(schema.notifications.demandeId, demande.id))
          ).length
        ).toBe(0)
        expect(
          (await pgliteDb.select().from(schema.notifications)).length
        ).toBe(notifsAvant)
      } finally {
        course.restaurer()
        await liberer(occupe, numeroPour(compteur + 500), creee!)
      }
    })

    it("rejoue une soumission tout aussi bien, notification comprise", async () => {
      const { occupe, compteur } = await occuperLeProchainNumero()
      const course = coursePerduee(numeroPour(compteur + 500))
      let creee: string | undefined

      try {
        const demande = await createAndSubmit(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        creee = demande.numero

        expect(course.tentatives()).toBe(2)
        expect(demande.numero).toBe(numeroPour(compteur + 2))
        expect(demande.numero).not.toBe(occupe)
        expect(demande.etape).toBe("MANAGER_REVIEW")

        const audit = await pgliteDb
          .select()
          .from(schema.journalAudit)
          .where(eq(schema.journalAudit.entiteId, demande.id))
        expect(audit).toHaveLength(1)

        const notifs = await pgliteDb
          .select()
          .from(schema.notifications)
          .where(eq(schema.notifications.demandeId, demande.id))
        expect(notifs.length).toBeGreaterThan(0)
      } finally {
        course.restaurer()
        await liberer(occupe, numeroPour(compteur + 500), creee!)
      }
    })

    // ── la borne ───────────────────────────────────────────────────────────

    it("refuse une création qui collisionne toujours, avec la collision nommée", async () => {
      const { occupe } = await occuperLeProchainNumero()
      const born = await lireLaBorn()
      const { appels, restaurer } = surveillerTransactions()
      const lignesAvant = await compterLignes()
      const journalAvant = (
        await pgliteDb.select().from(schema.journalAudit)
      ).length
      const notifsAvant = (
        await pgliteDb.select().from(schema.notifications)
      ).length

      let thrown: unknown
      try {
        thrown = await createAndSubmit(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
      } catch (e) {
        thrown = e
      }

      // The bound is named and finite — and a bound of one would be no retry
      // at all — and it is what refuses here, not the first collision.
      // The expectation above is DERIVED from the source, so on its own it
      // would read a bound of 99 as correct and happily sit through 99
      // transactions. The ceiling is what pins « small » (#292): a retry
      // bound that grew without limit would hold a Utilisateur's request
      // through an unbounded number of transactions.
      expect(born).not.toBeNull()
      expect(born!).toBeGreaterThanOrEqual(2)
      expect(born!).toBeLessThanOrEqual(5)
      expect(appels()).toBe(born!)

      // The refusal is the collision's own sentence and response code, not
      // « Erreur interne ».
      expect(thrown).toBeInstanceOf(NumeroCollisionError)
      const res = handleServiceError(thrown)
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "Le numéro de la demande est déjà utilisé",
      })

      // None of the attempts left a trace: no row, no journal, no
      // notification. The occupant is still there, so it is part of the
      // count.
      expect(await compterLignes()).toBe(lignesAvant)
      expect((await pgliteDb.select().from(schema.journalAudit)).length).toBe(
        journalAvant
      )
      expect((await pgliteDb.select().from(schema.notifications)).length).toBe(
        notifsAvant
      )

      restaurer()
      await liberer(occupe)
    })

    // ── une transaction par tentative, et rien de plus ─────────────────────

    it("n'ouvre qu'une transaction, et y écrit la ligne, son journal et sa notification", async () => {
      await poserEspionDeTransaction()
      const { appels, restaurer } = surveillerTransactions()

      try {
        await pgliteDb.execute(sql`DELETE FROM xid_espion;`)
        const demande = await createAndSubmit(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })

        // The retry adds no transaction of its own: one creation, one
        // transaction.
        expect(appels()).toBe(1)

        // The row, its journal entry and its notification were written by the
        // SAME transaction — the database's own transaction says so.
        const moments = await momentsDe(demande.id)
        expect(
          moments.filter((m) => m.startsWith("demandes_deplacement:"))
        ).toHaveLength(1)
        expect(
          moments.filter((m) => m.startsWith("journal_audit:"))
        ).toHaveLength(1)
        expect(
          moments.filter((m) => m.startsWith("notifications:")).length
        ).toBeGreaterThan(0)
        expect(new Set(await transactionsDe(demande.id)).size).toBe(1)

        await liberer(demande.numero)
      } finally {
        restaurer()
        await deposerEspionDeTransaction()
      }
    })

    it("n'ouvre pas de seconde transaction pour un rejeu, et la tentative refusée n'écrit rien", async () => {
      const { occupe, compteur } = await occuperLeProchainNumero()
      await poserEspionDeTransaction()
      const course = coursePerduee(numeroPour(compteur + 500))
      let creee: string | undefined

      try {
        await pgliteDb.execute(sql`DELETE FROM xid_espion;`)
        const demande = await createAndSubmit(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        creee = demande.numero

        // One transaction per attempt: two attempts, two transactions, and no
        // transaction of the retry's own.
        expect(course.tentatives()).toBe(2)

        // The winning attempt wrote its row, its journal entry and its
        // notifications in ONE transaction...
        const moments = await momentsDe(demande.id)
        expect(
          moments.filter((m) => m.startsWith("demandes_deplacement:"))
        ).toHaveLength(1)
        expect(
          moments.filter((m) => m.startsWith("journal_audit:"))
        ).toHaveLength(1)
        expect(
          moments.filter((m) => m.startsWith("notifications:")).length
        ).toBeGreaterThan(0)
        expect(new Set(await transactionsDe(demande.id)).size).toBe(1)

        // ...and only two transactions ever wrote a row that stuck: the
        // rival's, and the winning attempt's. The refused attempt's rolled
        // back, so it left neither a row, a journal entry nor a notification.
        const toutes = await transactionsDistinctes()
        expect(toutes).toHaveLength(2)
      } finally {
        course.restaurer()
        await deposerEspionDeTransaction()
        await liberer(occupe, numeroPour(compteur + 500), creee!)
      }
    })

    // ── le numéro garde ses propriétés après un rejeu ──────────────────────

    it("garde le préfixe d'année lu dans l'horloge après un rejeu", async () => {
      // The clock is frozen BEFORE the race is set up: the numéro is allocated
      // from the year, so an occupant carrying this year's prefix would not
      // collide with a 2031 numéro at all.
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2031-03-04T12:00:00Z"))
      let occupe: string | undefined
      let compteur = 0
      let creee: string | undefined
      let course: ReturnType<typeof coursePerduee> | undefined

      try {
        const courseSetup = await occuperLeProchainNumero()
        occupe = courseSetup.occupe
        compteur = courseSetup.compteur
        course = coursePerduee(numeroPour(compteur + 500))

        const demande = await createDraft(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        creee = demande.numero

        expect(course.tentatives()).toBe(2)
        expect(demande.numero).toMatch(/^DD-2031-\d{4}$/)
        expect(demande.numero).not.toBe(occupe)
      } finally {
        vi.useRealTimers()
        course?.restaurer()
        // Every row the test added, or the next test reads a count one too
        // low and walks onto an occupied numéro.
        await liberer(occupe!, numeroPour(compteur + 500), creee!)
      }
    })

    it("garde un compteur global après un rejeu : une ligne supprimée logiquement consomme toujours son numéro", async () => {
      const avant = await createDraft(sampleData, {
        id: employeeId,
        role: "EMPLOYEE",
      })
      await pgliteDb
        .update(schema.demandesDeplacement)
        .set({ deletedAt: new Date() })
        .where(eq(schema.demandesDeplacement.id, avant.id))

      // The soft-deleted row is still a row, so the count the retry reads
      // still counts it and its numéro stays consumed.
      const { occupe, compteur } = await occuperLeProchainNumero()
      const course = coursePerduee(numeroPour(compteur + 500))
      let creee: string | undefined

      try {
        const demande = await createDraft(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
        creee = demande.numero

        expect(course.tentatives()).toBe(2)
        expect(demande.numero).toBe(numeroPour(compteur + 2))
        expect(demande.numero).not.toBe(avant.numero)
        expect(demande.numero).not.toBe(occupe)
      } finally {
        course.restaurer()
        await liberer(occupe, numeroPour(compteur + 500), creee!)
      }
    })

    it("ne rejoue pas une erreur qui n'est pas une collision de numéro", async () => {
      await pgliteDb.execute(sql`
        CREATE OR REPLACE FUNCTION fail_demande_insert_rejeu()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $body$ BEGIN RAISE EXCEPTION 'Simulated demande insert failure (retry)'; END; $body$;
      `)
      await pgliteDb.execute(sql`
        CREATE TRIGGER trg_fail_demande_insert_rejeu
        BEFORE INSERT ON demandes_deplacement
        FOR EACH ROW EXECUTE FUNCTION fail_demande_insert_rejeu();
      `)

      const { appels, restaurer } = surveillerTransactions()
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})
      let thrown: unknown
      try {
        thrown = await createDraft(sampleData, {
          id: employeeId,
          role: "EMPLOYEE",
        })
      } catch (e) {
        thrown = e
      } finally {
        restaurer()
        await pgliteDb.execute(
          sql`DROP TRIGGER IF EXISTS trg_fail_demande_insert_rejeu ON demandes_deplacement`
        )
        await pgliteDb.execute(
          sql`DROP FUNCTION IF EXISTS fail_demande_insert_rejeu()`
        )
      }

      // Not a 23505: one attempt, no replay, and the error reaches the caller
      // as itself.
      expect(appels()).toBe(1)
      expect(thrown).toBeTruthy()
      expect(thrown).not.toBeInstanceOf(NumeroCollisionError)
      expect(handleServiceError(thrown).status).toBe(500)
      consoleError.mockRestore()
    })
  })
})