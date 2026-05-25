import { FileText, Clock, AlertCircle, CheckCircle, DollarSign, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatCurrency } from "@/lib/constants"
import type { DemandesStats } from "@/lib/dashboard"

export interface StatPill {
  icon: LucideIcon
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
  cta?: { label: string; href: string; icon: LucideIcon }
}

export function buildEmployeeConfig(stats: DemandesStats): DashboardConfig {
  return {
    subtitle: "Bienvenue sur votre espace personnel",
    statPills: [
      { icon: FileText, label: "Total", value: stats.total, color: "blue" },
      { icon: Clock, label: "Brouillons", value: stats.brouillon, color: "amber" },
      { icon: AlertCircle, label: "Soumises", value: stats.soumises, color: "orange" },
      { icon: CheckCircle, label: "Approuvées", value: stats.approuvees, color: "green" },
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
    cta: { label: "Nouvelle demande de déplacement", href: "/demandes/nouvelle", icon: Plus },
  }
}

export function buildManagerConfig(enAttente: number): DashboardConfig {
  return {
    subtitle: "Gérez les demandes de votre équipe",
    statPills: [
      { icon: AlertCircle, label: "En attente", value: enAttente, color: "orange" },
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
  }
}

export function buildFinanceConfig(enAttente: number): DashboardConfig {
  return {
    subtitle: "Administration & Finances",
    statPills: [
      { icon: AlertCircle, label: "En attente d'approbation", value: enAttente, color: "orange" },
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
  }
}

export function buildDirectionConfig(enAttente: number, budgetTotal: number): DashboardConfig {
  return {
    subtitle: "Direction Générale",
    statPills: [
      { icon: AlertCircle, label: "En attente", value: enAttente, color: "orange" },
      { icon: DollarSign, label: "Budget engagé", value: formatCurrency(budgetTotal), color: "purple" },
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
  }
}
