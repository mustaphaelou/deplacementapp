import { prisma } from "@/lib/prisma"
import type { StatutDemande, Role } from "@prisma/client"
import { formatCurrency } from "@/lib/constants"

// ─── Serializable configuration types ──────────────────────────────────────────

export interface StatPill {
  icon: string
  label: string
  value: number | string
  color: "blue" | "green" | "amber" | "orange" | "purple"
}

export type TableColumnId = "numero" | "employe" | "destination" | "dates" | "date" | "total" | "statut"

export interface TableColumn {
  id: TableColumnId
  label: string
  hideAt?: "sm" | "md" | "lg"
}

export interface DashboardTableConfig {
  title: string
  columns: TableColumn[]
  viewAllHref: string
  emptyMessage: string
}

export interface DashboardConfig {
  subtitle: string
  statPills: StatPill[]
  table: DashboardTableConfig
  cta?: { label: string; href: string; icon: string }
}

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

export interface DashboardPayload {
  config: DashboardConfig
  demandes: DashboardDemandeSummary[]
}

// ─── Pure function: stats aggregation ────────────────────────────────────────

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

// ─── Query module (internal, policy-agnostic) ───────────────────────────────

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

// ─── Consolidated deep interface ───────────────────────────────────────────

export async function getDashboardPayload(
  userId: string,
  role: Role
): Promise<DashboardPayload> {
  switch (role) {
    case "EMPLOYEE": {
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

      const stats = computeStats(statutCounts)
      return {
        config: {
          subtitle: "Bienvenue sur votre espace personnel",
          statPills: [
            { icon: "file-text", label: "Total", value: stats.total, color: "blue" },
            { icon: "clock", label: "Brouillons", value: stats.brouillon, color: "amber" },
            { icon: "alert-circle", label: "Soumises", value: stats.soumises, color: "orange" },
            { icon: "check-circle", label: "Approuvées", value: stats.approuvees, color: "green" },
          ],
          table: {
            title: "Mes dernières demandes",
            columns: [
              { id: "numero", label: "N°" },
              { id: "destination", label: "Destination", hideAt: "sm" },
              { id: "dates", label: "Dates", hideAt: "md" },
              { id: "total", label: "Total", hideAt: "lg" },
              { id: "statut", label: "Statut" },
            ],
            viewAllHref: "/demandes",
            emptyMessage: "Aucune demande pour le moment.",
          },
          cta: { label: "Nouvelle demande de déplacement", href: "/demandes/nouvelle", icon: "plus" },
        },
        demandes: demandes.map(mapToSummary),
      }
    }
    case "MANAGER": {
      const [demandes, enAttente] = await Promise.all([
        fetchDemandesByStatuts(["SOUMISE"], { includeEmployee: true, limit: 10, orderBy: { soumiseLe: "desc" } }),
        countByStatut("SOUMISE"),
      ])

      return {
        config: {
          subtitle: "Gérez les demandes de votre équipe",
          statPills: [
            { icon: "alert-circle", label: "En attente", value: enAttente, color: "orange" },
          ],
          table: {
            title: "Demandes en attente d'approbation",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "date", label: "Date", hideAt: "md" },
              { id: "statut", label: "Statut" },
            ],
            viewAllHref: "/demandes?statut=SOUMISE",
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "FINANCE_ADMIN": {
      const [demandes, enAttente] = await Promise.all([
        fetchDemandesByStatuts(["APPROUVEE_MANAGER"], { includeEmployee: true, limit: 10, orderBy: { approuveeManagerLe: "desc" } }),
        countByStatut("APPROUVEE_MANAGER"),
      ])

      return {
        config: {
          subtitle: "Administration & Finances",
          statPills: [
            { icon: "alert-circle", label: "En attente d'approbation", value: enAttente, color: "orange" },
          ],
          table: {
            title: "Demandes en attente d'approbation financière",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "total", label: "Total", hideAt: "md" },
              { id: "statut", label: "Statut" },
            ],
            viewAllHref: "/demandes?statut=APPROUVEE_MANAGER",
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "GENERAL_DIRECTION": {
      const [demandes, enAttente, budgetTotal] = await Promise.all([
        fetchDemandesByStatuts(["APPROUVEE_FINANCE"], { includeEmployee: true, limit: 10, orderBy: { approuveeFinanceLe: "desc" } }),
        countByStatut("APPROUVEE_FINANCE"),
        aggregateBudget(["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"]),
      ])

      return {
        config: {
          subtitle: "Direction Générale",
          statPills: [
            { icon: "alert-circle", label: "En attente", value: enAttente, color: "orange" },
            { icon: "dollar-sign", label: "Budget engagé", value: formatCurrency(budgetTotal), color: "purple" },
          ],
          table: {
            title: "Demandes en attente d'approbation finale",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "total", label: "Total", hideAt: "md" },
              { id: "statut", label: "Statut" },
            ],
            viewAllHref: "/demandes?statut=APPROUVEE_FINANCE",
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    default: {
      throw new Error(`Role non supporté: ${role}`)
    }
  }
}