import { describe, it, expect, vi, beforeEach } from "vitest"
import { getDashboardPayload } from "./dashboard"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/constants"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    demandeDeplacement: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

describe("Dashboard Module - getDashboardPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
      getDemandesByUser: vi.fn().mockResolvedValue(mockDemandes as any),
      countByStatut: vi.fn().mockImplementation((statut: string) => {
        if (statut === "BROUILLON") return Promise.resolve(1)
        if (statut === "SOUMISE") return Promise.resolve(2)
        return Promise.resolve(0)
      }),
    }

    const payload = await getDashboardPayload("user-emp", "EMPLOYEE", fakeService)

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

  it("returns correct payload for MANAGER role", async () => {
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

    vi.mocked(prisma.demandeDeplacement.findMany).mockResolvedValue(mockDemandes as any)
    vi.mocked(prisma.demandeDeplacement.count).mockResolvedValue(1)

    const payload = await getDashboardPayload("user-mgr", "MANAGER")

    expect(prisma.demandeDeplacement.findMany).toHaveBeenCalledWith({
      where: { statut: { in: ["SOUMISE"] }, deletedAt: null },
      orderBy: { soumiseLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    expect(payload.config.subtitle).toBe("Gérez les demandes de votre équipe")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
    ])
    expect(payload.demandes).toHaveLength(1)
    expect(payload.demandes[0].employe).toEqual({ prenom: "Ali", nom: "Kader" })
  })

  it("returns correct payload for FINANCE_ADMIN role", async () => {
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

    vi.mocked(prisma.demandeDeplacement.findMany).mockResolvedValue(mockDemandes as any)
    vi.mocked(prisma.demandeDeplacement.count).mockResolvedValue(1)

    const payload = await getDashboardPayload("user-fin", "FINANCE_ADMIN")

    expect(prisma.demandeDeplacement.findMany).toHaveBeenCalledWith({
      where: { statut: { in: ["APPROUVEE_MANAGER"] }, deletedAt: null },
      orderBy: { approuveeManagerLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    expect(payload.config.subtitle).toBe("Administration & Finances")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente d'approbation", value: 1, color: "orange" },
    ])
  })

  it("returns correct payload for GENERAL_DIRECTION role", async () => {
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

    vi.mocked(prisma.demandeDeplacement.findMany).mockResolvedValue(mockDemandes as any)
    vi.mocked(prisma.demandeDeplacement.count).mockResolvedValue(1)
    vi.mocked(prisma.demandeDeplacement.aggregate).mockResolvedValue({
      _sum: { totalEstime: 15000 },
    } as any)

    const payload = await getDashboardPayload("user-dir", "GENERAL_DIRECTION")

    expect(prisma.demandeDeplacement.findMany).toHaveBeenCalledWith({
      where: { statut: { in: ["APPROUVEE_FINANCE"] }, deletedAt: null },
      orderBy: { approuveeFinanceLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    expect(payload.config.subtitle).toBe("Direction Générale")
    expect(payload.config.statPills).toEqual([
      { icon: "alert-circle", label: "En attente", value: 1, color: "orange" },
      { icon: "dollar-sign", label: "Budget engagé", value: formatCurrency(15000), color: "purple" },
    ])
  })
})
