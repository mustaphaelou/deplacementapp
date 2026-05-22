import { prisma } from "@/lib/prisma"
import type { StatutDemande } from "@prisma/client"

// ─── Shared types ───────────────────────────────────────────

export interface DashboardDemandeSummary {
  id: string
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  totalEstime: number | null
  statut: string
  employe: { prenom: string; nom: string } | null
}

// ─── Pure function: stats aggregation ───────────────────────

export interface DemandesStats {
  total: number
  brouillon: number
  soumises: number
  approuvees: number
}

export function computeStats(counts: { statut: string; _count: number }[]): DemandesStats {
  const byStatut = Object.fromEntries(counts.map((g) => [g.statut, g._count]))
  return {
    total: Object.values(byStatut).reduce((a, b) => a + b, 0),
    brouillon: byStatut["BROUILLON"] ?? 0,
    soumises: byStatut["SOUMISE"] ?? 0,
    approuvees: byStatut["APPROUVEE"] ?? 0,
  }
}

function mapToSummary(demande: any): DashboardDemandeSummary {
  return {
    id: demande.id,
    numero: demande.numero,
    destination: demande.destination,
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    totalEstime: demande.totalEstime ? Number(demande.totalEstime) : null,
    statut: demande.statut,
    employe: demande.employe ? { prenom: demande.employe.prenom, nom: demande.employe.nom } : null,
  }
}

// ─── Query module (internal, policy-agnostic) ───────────────

async function fetchDemandesByStatuts(
  statuts: StatutDemande[],
  opts: { limit?: number; includeEmployee?: boolean; orderBy?: any } = {}
): Promise<DashboardDemandeSummary[]> {
  const { limit = 10, includeEmployee = false, orderBy = { creeLe: "desc" } } = opts

  const demandes = await prisma.demandeDeplacement.findMany({
    where: { statut: { in: statuts }, deletedAt: null },
    orderBy,
    take: limit,
    include: includeEmployee ? { employe: { select: { prenom: true, nom: true } } } : undefined,
  })

  return demandes.map(mapToSummary)
}

async function countByStatut(statut: StatutDemande): Promise<number> {
  return prisma.demandeDeplacement.count({ where: { statut, deletedAt: null } })
}

async function aggregateBudget(statuses: StatutDemande[]): Promise<number> {
  const result = await prisma.demandeDeplacement.aggregate({
    _sum: { totalEstime: true },
    where: { statut: { in: statuses }, deletedAt: null },
  })
  return Number(result._sum?.totalEstime ?? 0)
}

// ─── Role-specific adapters ─────────────────────────────────

export interface EmployeeDashboardData {
  demandes: DashboardDemandeSummary[]
  stats: DemandesStats
}

export async function getEmployeeDashboard(userId: string): Promise<EmployeeDashboardData> {
  const [demandes, statutCounts] = await Promise.all([
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

  return {
    demandes: demandes.map(mapToSummary),
    stats: computeStats(statutCounts),
  }
}

export interface ManagerDashboardData {
  demandes: DashboardDemandeSummary[]
  enAttente: number
}

export async function getManagerDashboard(): Promise<ManagerDashboardData> {
  const [demandes, enAttente] = await Promise.all([
    fetchDemandesByStatuts(["SOUMISE"], { includeEmployee: true, limit: 10, orderBy: { soumiseLe: "desc" } }),
    countByStatut("SOUMISE"),
  ])

  return { demandes, enAttente }
}

export interface FinanceDashboardData {
  demandes: DashboardDemandeSummary[]
  enAttente: number
}

export async function getFinanceDashboard(): Promise<FinanceDashboardData> {
  const [demandes, enAttente] = await Promise.all([
    fetchDemandesByStatuts(["APPROUVEE_MANAGER"], { includeEmployee: true, limit: 10, orderBy: { approuveeManagerLe: "desc" } }),
    countByStatut("APPROUVEE_MANAGER"),
  ])

  return { demandes, enAttente }
}

export interface DirectionDashboardData {
  demandes: DashboardDemandeSummary[]
  enAttente: number
  budgetTotal: number
}

export async function getDirectionDashboard(): Promise<DirectionDashboardData> {
  const [demandes, enAttente, budgetTotal] = await Promise.all([
    fetchDemandesByStatuts(["APPROUVEE_FINANCE"], { includeEmployee: true, limit: 10, orderBy: { approuveeFinanceLe: "desc" } }),
    countByStatut("APPROUVEE_FINANCE"),
    aggregateBudget(["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"]),
  ])

  return { demandes, enAttente, budgetTotal }
}