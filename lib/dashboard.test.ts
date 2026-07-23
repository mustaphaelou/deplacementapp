import { describe, it, expect, vi } from "vitest"
import { getDashboardPayload } from "./dashboard"
import type { DemandeQueryPort } from "./demande/ports/demande-query-port"
import type { DashboardDemandeSummary } from "./dashboard"
import { formatCurrency } from "@/lib/constants"

describe("Dashboard Module - getDashboardPayload", () => {

  it("returns correct payload for EMPLOYEE role (injected fake service)", async () => {
    const mockDemandes = [
      {
        id: "d-1",
        numero: "DD-2026-0001",
        destination: "Casablanca",
        dateDepart: new Date("2026-06-01"),
        dateRetour: new Date("2026-06-05"),
        totalEstime: 1500,
        statut: "BROUILLON",
        employe: null,
      },
    ]

    const fakeService = {
      findByEmployeeId: vi.fn().mockResolvedValue(mockDemandes as DashboardDemandeSummary[]),
      findByStatuts: vi.fn(),
      countByStatut: vi.fn().mockImplementation((statut: string) => {
        if (statut === "BROUILLON") return Promise.resolve(1)
        if (statut === "SOUMISE") return Promise.resolve(2)
        return Promise.resolve(0)
      }),
      aggregateBudget: vi.fn(),
    } satisfies Partial<DemandeQueryPort>

    const payload = await getDashboardPayload("user-emp", "EMPLOYEE", fakeService as unknown as DemandeQueryPort)

    expect(payload.config.subtitle).toBe("Bienvenue sur votre espace personnel")
    expect(payload.config.statPills).toEqual([
      { icon: "file-text", label: "Total", value: 3, color: "blue" },
      { icon: "clock", label: "Brouillons", value: 1, color: "amber" },
      { icon: "alert-circle", label: "Soumises", value: 2, color: "orange" },
      { icon: "check-circle", label: "Approuvées", value: 0, color: "green" },
    ])
    expect(payload.config.cta?.icon).toBe("plus")
    expect(payload.demandes).toHaveLength(1)
    expect(payload.demandes[0].numero).toBe("DD-2026-0001")
  })

  it("returns correct payload for MANAGER role (injected fake service)", async () => {
    const mockDemandes = [
      {
        id: "d-2",
        numero: "DD-2026-0002",
        destination: "Rabat",
        dateDepart: new Date("2026-06-10"),
        dateRetour: new Date("2026-06-12"),
        totalEstime: 800,
        statut: "SOUMISE",
        employe: { prenom: "Ali", nom: "Kader" },
      },
    ]

    const fakeService = {
      findByEmployeeId: vi.fn(),
      findByStatuts: vi.fn().mockResolvedValue(mockDemandes as DashboardDemandeSummary[]),
      countByStatut: vi.fn().mockResolvedValue(1),
      aggregateBudget: vi.fn(),
    } satisfies Partial<DemandeQueryPort>

    const payload = await getDashboardPayload("user-mgr", "MANAGER", fakeService as unknown as DemandeQueryPort)

    expect(fakeService.findByStatuts).toHaveBeenCalledWith(
      ["SOUMISE"],
      { includeEmployee: true, limit: 10, orderBy: { column: "soumiseLe", direction: "desc" } }
    )

    expect(payload.config.subtitle).toBe("Gérez les demandes de votre équipe")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
    ])
    expect(payload.demandes).toHaveLength(1)
    expect(payload.demandes[0].employe).toEqual({ prenom: "Ali", nom: "Kader" })
  })

  it("returns correct payload for FINANCE_ADMIN role (injected fake service)", async () => {
    const mockDemandes = [
      {
        id: "d-3",
        numero: "DD-2026-0003",
        destination: "Tangier",
        dateDepart: new Date("2026-06-15"),
        dateRetour: new Date("2026-06-20"),
        totalEstime: 2200,
        statut: "APPROUVEE_MANAGER",
        employe: { prenom: "Sarah", nom: "Bennani" },
      },
    ]

    const fakeService = {
      findByEmployeeId: vi.fn(),
      findByStatuts: vi.fn().mockResolvedValue(mockDemandes as DashboardDemandeSummary[]),
      countByStatut: vi.fn().mockResolvedValue(1),
      aggregateBudget: vi.fn(),
    } satisfies Partial<DemandeQueryPort>

    const payload = await getDashboardPayload("user-fin", "FINANCE_ADMIN", fakeService as unknown as DemandeQueryPort)

    expect(fakeService.findByStatuts).toHaveBeenCalledWith(
      ["APPROUVEE_MANAGER"],
      { includeEmployee: true, limit: 10, orderBy: { column: "approuveeManagerLe", direction: "desc" } }
    )

    expect(payload.config.subtitle).toBe("Administration & Finances")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente d'approbation", value: 1, color: "orange" },
    ])
  })

  it("returns correct payload for GENERAL_DIRECTION role (injected fake service)", async () => {
    const mockDemandes = [
      {
        id: "d-4",
        numero: "DD-2026-0004",
        destination: "Marrakech",
        dateDepart: new Date("2026-06-22"),
        dateRetour: new Date("2026-06-25"),
        totalEstime: 5000,
        statut: "APPROUVEE_FINANCE",
        employe: { prenom: "Omar", nom: "Alami" },
      },
    ]

    const fakeService = {
      findByEmployeeId: vi.fn(),
      findByStatuts: vi.fn().mockResolvedValue(mockDemandes as DashboardDemandeSummary[]),
      countByStatut: vi.fn().mockResolvedValue(1),
      aggregateBudget: vi.fn().mockResolvedValue(15000),
    } satisfies Partial<DemandeQueryPort>

    const payload = await getDashboardPayload("user-dir", "GENERAL_DIRECTION", fakeService as unknown as DemandeQueryPort)

    expect(fakeService.findByStatuts).toHaveBeenCalledWith(
      ["APPROUVEE_FINANCE"],
      { includeEmployee: true, limit: 10, orderBy: { column: "approuveeFinanceLe", direction: "desc" } }
    )
    expect(fakeService.countByStatut).toHaveBeenCalledWith("APPROUVEE_FINANCE")
    expect(fakeService.aggregateBudget).toHaveBeenCalledWith(
      ["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"]
    )

    expect(payload.config.subtitle).toBe("Direction Générale")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
      { icon: "dollar-sign", label: "Budget engagé", value: formatCurrency(15000), color: "purple" },
    ])
  })
})
