import { prisma } from "@/lib/prisma"

export interface DashboardDemande {
  id: string
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  totalEstime: number | null
  statut: string
  employe?: { prenom: string; nom: string }
}

export interface DashboardData {
  demandes: DashboardDemande[]
  stats?: {
    total: number
    brouillon: number
    soumises: number
    approuvees: number
  }
  enAttente?: number
  budgetTotal?: number
}

export async function getDashboardData(
  userId: string,
  role: string
): Promise<DashboardData> {
  if (role === "EMPLOYEE") {
    const [demandes, total, brouillon, soumises, approuvees] =
      await Promise.all([
        prisma.demandeDeplacement.findMany({
          where: { employeId: userId, deletedAt: null },
          orderBy: { creeLe: "desc" },
          take: 5,
        }),
        prisma.demandeDeplacement.count({
          where: { employeId: userId, deletedAt: null },
        }),
        prisma.demandeDeplacement.count({
          where: { employeId: userId, statut: "BROUILLON", deletedAt: null },
        }),
        prisma.demandeDeplacement.count({
          where: { employeId: userId, statut: "SOUMISE", deletedAt: null },
        }),
        prisma.demandeDeplacement.count({
          where: { employeId: userId, statut: "APPROUVEE", deletedAt: null },
        }),
      ])

    return {
      demandes,
      stats: { total, brouillon, soumises, approuvees },
    }
  }

  if (role === "MANAGER") {
    const [enAttente, demandes] = await Promise.all([
      prisma.demandeDeplacement.count({
        where: { statut: "SOUMISE", deletedAt: null },
      }),
      prisma.demandeDeplacement.findMany({
        where: { statut: "SOUMISE", deletedAt: null },
        orderBy: { soumiseLe: "desc" },
        take: 10,
        include: {
          employe: { select: { prenom: true, nom: true } },
        },
      }),
    ])

    return { demandes, enAttente }
  }

  if (role === "FINANCE_ADMIN") {
    const [enAttente, demandes] = await Promise.all([
      prisma.demandeDeplacement.count({
        where: { statut: "APPROUVEE_MANAGER", deletedAt: null },
      }),
      prisma.demandeDeplacement.findMany({
        where: { statut: "APPROUVEE_MANAGER", deletedAt: null },
        orderBy: { approuveeManagerLe: "desc" },
        take: 10,
        include: {
          employe: { select: { prenom: true, nom: true } },
        },
      }),
    ])

    return { demandes, enAttente }
  }

  if (role === "GENERAL_DIRECTION") {
    const [enAttente, totalBudget, demandes] = await Promise.all([
      prisma.demandeDeplacement.count({
        where: { statut: "APPROUVEE_FINANCE", deletedAt: null },
      }),
      prisma.demandeDeplacement.aggregate({
        _sum: { totalEstime: true },
        where: {
          statut: {
            in: ["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"],
          },
          deletedAt: null,
        },
      }),
      prisma.demandeDeplacement.findMany({
        where: { statut: "APPROUVEE_FINANCE", deletedAt: null },
        orderBy: { approuveeFinanceLe: "desc" },
        take: 10,
        include: {
          employe: { select: { prenom: true, nom: true } },
        },
      }),
    ])

    return {
      demandes,
      enAttente,
      budgetTotal: Number(totalBudget._sum.totalEstime ?? 0),
    }
  }

  return { demandes: [] }
}
