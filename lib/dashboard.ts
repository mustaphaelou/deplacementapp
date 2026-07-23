import type { Role } from "@prisma/client"
import { formatCurrency } from "@/lib/constants"
import { demandeService } from "./demande/di"
import type { DemandeQueryPort } from "./demande/ports/demande-query-port"
import { queueEtapes, committedEtapes, rollupEtapes, resolveStatuts, laneOrderByColumn, type Etape } from "./workflow"

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

// ─── Shared fetch pattern ────────────────────────────────────────────────

async function fetchQueueDemandes(
  queries: DemandeQueryPort,
  role: Role,
  lane: Etape
): Promise<{ demandes: DashboardDemandeSummary[]; enAttente: number }> {
  const queue = resolveStatuts(queueEtapes(role))
  const order = laneOrderByColumn(lane)
  const [demandes, queueCounts] = await Promise.all([
    queries.findByStatuts(queue, { includeEmployee: true, limit: 10, orderBy: order }),
    Promise.all(queue.map((s) => queries.countByStatut(s))),
  ])
  return { demandes, enAttente: queueCounts.reduce((a, b) => a + b, 0) }
}

// ─── Consolidated deep interface ───────────────────────────────────────────

export async function getDashboardPayload(
  userId: string,
  role: Role,
  svc?: DemandeQueryPort
): Promise<DashboardPayload> {
  const queries = svc ?? demandeService.queries
  switch (role) {
    case "EMPLOYEE": {
      const queue = resolveStatuts(queueEtapes(role))
      const committed = resolveStatuts(committedEtapes(role))
      const rollup = resolveStatuts(rollupEtapes(role))

      const [demandes, rollupCounts] = await Promise.all([
        queries.findByEmployeeId(userId, 5),
        Promise.all(rollup.map((s) => queries.countByStatut(s, userId))),
      ])

      const countMap = Object.fromEntries(rollup.map((s, i) => [s, rollupCounts[i]]))
      const queueCount = queue.reduce((sum, s) => sum + (countMap[s] ?? 0), 0)
      const committedCount = committed.reduce((sum, s) => sum + (countMap[s] ?? 0), 0)
      const total = rollupCounts.reduce((a, b) => a + b, 0)
      const submittedCount = total - queueCount - committedCount

      return {
        config: {
          subtitle: "Bienvenue sur votre espace personnel",
          statPills: [
            { icon: "file-text", label: "Total", value: total, color: "blue" },
            { icon: "clock", label: "Brouillons", value: queueCount, color: "amber" },
            { icon: "alert-circle", label: "Soumises", value: submittedCount, color: "orange" },
            { icon: "check-circle", label: "Approuvées", value: committedCount, color: "green" },
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
      const { demandes, enAttente } = await fetchQueueDemandes(queries, role, "MANAGER_REVIEW")

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
            viewAllHref: `/demandes?statut=${resolveStatuts(queueEtapes(role))[0]}`,
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "FINANCE_ADMIN": {
      const { demandes, enAttente } = await fetchQueueDemandes(queries, role, "FINANCE_REVIEW")

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
            viewAllHref: `/demandes?statut=${resolveStatuts(queueEtapes(role))[0]}`,
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "GENERAL_DIRECTION": {
      const committed = resolveStatuts(committedEtapes(role))
      const [queueResult, budgetTotal] = await Promise.all([
        fetchQueueDemandes(queries, role, "DIRECTION_REVIEW"),
        queries.aggregateBudget(committed),
      ])
      const { demandes, enAttente } = queueResult

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
            viewAllHref: `/demandes?statut=${resolveStatuts(queueEtapes(role))[0]}`,
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