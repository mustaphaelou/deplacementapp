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

function mapToDashboardDemande(demande: any): DashboardDemande {
  return {
    id: demande.id,
    numero: demande.numero,
    destination: demande.destination,
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    totalEstime: demande.totalEstime ? Number(demande.totalEstime) : null,
    statut: demande.statut,
    employe: demande.employe ? { prenom: demande.employe.prenom, nom: demande.employe.nom } : undefined,
  }
}

export async function getDashboardData(
  userId: string,
  role: string
): Promise<DashboardData> {
  if (role === "EMPLOYEE") {
    const [demandes, statutCounts] =
      await Promise.all([
        prisma.demandeDeplacement.findMany({
          where: { employeId: userId, deletedAt: null },
          orderBy: { creeLe: "desc" },
          take: 5,
        }),
        prisma.demandeDeplacement.groupBy({
          by: ["statut"],
          where: { employeId: userId, deletedAt: null },
          _count: true,
        }),
      ])

    const byStatut = Object.fromEntries(statutCounts.map((g) => [g.statut, g._count]))
    return {
      demandes: demandes.map(mapToDashboardDemande),
      stats: {
        total: Object.values(byStatut).reduce((a, b) => a + b, 0),
        brouillon: byStatut["BROUILLON"] ?? 0,
        soumises: byStatut["SOUMISE"] ?? 0,
        approuvees: byStatut["APPROUVEE"] ?? 0,
      },
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

    return { demandes: demandes.map(mapToDashboardDemande), enAttente }
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

    return { demandes: demandes.map(mapToDashboardDemande), enAttente }
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
      demandes: demandes.map(mapToDashboardDemande),
      enAttente,
      budgetTotal: Number(totalBudget._sum.totalEstime ?? 0),
    }
  }

  return { demandes: [] }
}
