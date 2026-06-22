import type { StatutDemande, Role } from "@prisma/client"
import { formatCurrency } from "@/lib/constants"
import { demandeService } from "./demande-service"

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

// ─── Consolidated deep interface ───────────────────────────────────────────

export async function getDashboardPayload(
  userId: string,
  role: Role,
  svc?: {
    findByEmployeeId: (userId: string, limit?: number) => Promise<DashboardDemandeSummary[]>
    findByStatuts: (statuts: StatutDemande[], opts?: { limit?: number; includeEmployee?: boolean; orderBy?: any }) => Promise<DashboardDemandeSummary[]>
    countByStatut: (statut: StatutDemande, userId?: string) => Promise<number>
    aggregateBudget: (statuts: StatutDemande[]) => Promise<number>
  }
): Promise<DashboardPayload> {
  const service = svc ?? demandeService
  switch (role) {
    case "EMPLOYEE": {
      const [demandes, brouillon, soumises, approuvees] = await Promise.all([
        service.findByEmployeeId(userId, 5),
        service.countByStatut("BROUILLON", userId),
        service.countByStatut("SOUMISE", userId),
        service.countByStatut("APPROUVEE", userId),
      ])
      const total = brouillon + soumises + approuvees

      return {
        config: {
          subtitle: "Bienvenue sur votre espace personnel",
          statPills: [
            { icon: "file-text", label: "Total", value: total, color: "blue" },
            { icon: "clock", label: "Brouillons", value: brouillon, color: "amber" },
            { icon: "alert-circle", label: "Soumises", value: soumises, color: "orange" },
            { icon: "check-circle", label: "Approuvées", value: approuvees, color: "green" },
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
        demandes,
      }
    }
    case "MANAGER": {
      const [demandes, enAttente] = await Promise.all([
        service.findByStatuts(["SOUMISE"], { includeEmployee: true, limit: 10, orderBy: { soumiseLe: "desc" } }),
        service.countByStatut("SOUMISE"),
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
        service.findByStatuts(["APPROUVEE_MANAGER"], { includeEmployee: true, limit: 10, orderBy: { approuveeManagerLe: "desc" } }),
        service.countByStatut("APPROUVEE_MANAGER"),
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
        service.findByStatuts(["APPROUVEE_FINANCE"], { includeEmployee: true, limit: 10, orderBy: { approuveeFinanceLe: "desc" } }),
        service.countByStatut("APPROUVEE_FINANCE"),
        service.aggregateBudget(["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"]),
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