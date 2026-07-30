import { describe, it, expect, beforeAll, vi } from "vitest"
import { getDashboardPayload } from "./dashboard"
import { formatCurrency } from "./constants"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import * as schema from "../db/schema"
import * as dbModule from "../db"
import { createDraft, createAndSubmit, executeTransition } from "./demande/mutations"
import type { Role } from "@/lib/auth"

const TIMEOUT = 30_000

const sampleData = {
  motif: ["mission_client"],
  dateDepart: "2025-07-01",
  dateRetour: "2025-07-03",
  destination: "Casablanca",
  typeTransport: "AVION" as const,
  fraisTransport: "1500",
  fraisHebergement: "2000",
  fraisRepas: "800",
  fraisDivers: "300",
  avanceRequise: false,
  montantAvance: "0",
  description: "Mission client",
}

describe("Dashboard Module - getDashboardPayload (PGLite)", { timeout: TIMEOUT }, () => {
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

    await createDraft(
      { ...sampleData, destination: "Rabat" },
      { id: employeeId, role: "EMPLOYEE" },
    )

    await createAndSubmit(
      { ...sampleData, destination: "Marrakech" },
      { id: employeeId, role: "EMPLOYEE" },
    )

    const financeReview = await createAndSubmit(
      { ...sampleData, destination: "Tanger", fraisTransport: "2000" },
      { id: employeeId, role: "EMPLOYEE" },
    )
    await executeTransition({
      demandeId: financeReview.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })

    const directionReview = await createAndSubmit(
      { ...sampleData, destination: "Fes", fraisTransport: "2500" },
      { id: employeeId, role: "EMPLOYEE" },
    )
    await executeTransition({
      demandeId: directionReview.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })
    await executeTransition({
      demandeId: directionReview.id,
      action: "approuver",
      actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
    })

    const fullyApproved = await createAndSubmit(
      { ...sampleData, destination: "Agadir", fraisTransport: "3000" },
      { id: employeeId, role: "EMPLOYEE" },
    )
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: managerId, role: "MANAGER" },
    })
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: financeAdminId, role: "FINANCE_ADMIN" },
    })
    await executeTransition({
      demandeId: fullyApproved.id,
      action: "approuver",
      actor: { id: directionId, role: "GENERAL_DIRECTION" },
    })
  })

  it("returns correct payload for EMPLOYEE role", async () => {
    const payload = await getDashboardPayload(employeeId, "EMPLOYEE" as Role)

    expect(payload.config.subtitle).toBe("Bienvenue sur votre espace personnel")
    expect(payload.config.statPills).toEqual([
      { icon: "file-text", label: "Total", value: 3, color: "blue" },
      { icon: "clock", label: "Brouillons", value: 1, color: "amber" },
      { icon: "alert-circle", label: "Soumises", value: 1, color: "orange" },
      { icon: "check-circle", label: "Approuvées", value: 1, color: "green" },
    ])
    expect(payload.config.cta?.icon).toBe("plus")
    expect(payload.demandes.length).toBeLessThanOrEqual(5)
  })

  it("returns correct payload for MANAGER role", async () => {
    const payload = await getDashboardPayload(managerId, "MANAGER" as Role)

    expect(payload.config.subtitle).toBe("Gérez les demandes de votre équipe")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
    ])
    expect(payload.config.table.title).toBe("Demandes en attente d'approbation")
    for (const d of payload.demandes) {
      expect(d.etape).toBe("MANAGER_REVIEW")
      expect(d.employe).toBeDefined()
    }
  })

  it("returns correct payload for FINANCE_ADMIN role", async () => {
    const payload = await getDashboardPayload(financeAdminId, "FINANCE_ADMIN" as Role)

    expect(payload.config.subtitle).toBe("Administration & Finances")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente d'approbation", value: 1, color: "orange" },
    ])
    expect(payload.config.table.title).toBe("Demandes en attente d'approbation financière")
    for (const d of payload.demandes) {
      expect(d.etape).toBe("FINANCE_REVIEW")
      expect(d.employe).toBeDefined()
    }
  })

  it("returns correct payload for GENERAL_DIRECTION role", async () => {
    const payload = await getDashboardPayload(directionId, "GENERAL_DIRECTION" as Role)

    expect(payload.config.subtitle).toBe("Direction Générale")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
      { icon: "dollar-sign", label: "Budget engagé", value: formatCurrency(16800), color: "purple" },
    ])
    expect(payload.config.table.title).toBe("Demandes en attente d'approbation finale")
    for (const d of payload.demandes) {
      expect(d.etape).toBe("DIRECTION_REVIEW")
      expect(d.employe).toBeDefined()
    }
  })
})
