import { formatCurrency } from "@/lib/constants"
import {
  findPendingByEtapes,
  countDemandes,
  findByEmployeeId,
  aggregateBudget,
} from "./demande"
import type { Role } from "@/lib/auth"
import {
  queueEtapes,
  committedEtapes,
  laneOrderByColumn,
  PIPELINE,
  type Etape,
} from "./workflow"

export interface DashboardDemandeSummary {
  id: string
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  totalEstime: number | null
  etape: string
  decision: string
  employe: { prenom: string; nom: string } | null
}

// ─── Serializable configuration types ──────────────────────────────────────────

export interface StatPill {
  icon: string
  label: string
  value: number | string
  color: "blue" | "green" | "amber" | "orange" | "purple"
}

export type TableColumnId =
  "numero" | "employe" | "destination" | "dates" | "date" | "total" | "etape"

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
  role: Role,
  lane: Etape
): Promise<{ demandes: DashboardDemandeSummary[]; enAttente: number }> {
  const queue = queueEtapes(role)
  const order = laneOrderByColumn(lane)
  const [demandes, queueCounts] = await Promise.all([
    findPendingByEtapes(queue, {
      includeEmployee: true,
      limit: 10,
      orderBy: order,
    }),
    Promise.all(
      queue.map((s) => countDemandes({ etape: s, decision: "PENDING" }))
    ),
  ])
  return { demandes, enAttente: queueCounts.reduce((a, b) => a + b, 0) }
}

// ─── Consolidated deep interface ───────────────────────────────────────────

export async function getDashboardPayload(
  userId: string,
  role: Role
): Promise<DashboardPayload> {
  switch (role) {
    case "EMPLOYEE": {
      // The review lanes: the pipeline stages other than the draft lane and
      // the terminal lane — derived from PIPELINE, never re-listed.
      const reviewLanes = PIPELINE.filter(
        (stage) => stage.id !== "DRAFT" && stage.id !== "FINAL"
      ).map((stage) => stage.id)

      const [demandes, brouillons, soumisesCounts, approuvees, total] =
        await Promise.all([
          findByEmployeeId(userId, 5),
          countDemandes({
            etape: "DRAFT",
            decision: "PENDING",
            employeId: userId,
          }),
          Promise.all(
            reviewLanes.map((etape) =>
              countDemandes({ etape, decision: "PENDING", employeId: userId })
            )
          ),
          countDemandes({ etape: "FINAL", employeId: userId }),
          countDemandes({ employeId: userId }),
        ])
      const soumises = soumisesCounts.reduce((a, b) => a + b, 0)

      return {
        config: {
          subtitle: "Bienvenue sur votre espace personnel",
          statPills: [
            { icon: "file-text", label: "Total", value: total, color: "blue" },
            {
              icon: "clock",
              label: "Brouillons",
              value: brouillons,
              color: "amber",
            },
            {
              icon: "alert-circle",
              label: "Soumises",
              value: soumises,
              color: "orange",
            },
            {
              icon: "check-circle",
              label: "Approuvées",
              value: approuvees,
              color: "green",
            },
          ],
          table: {
            title: "Mes dernières demandes",
            columns: [
              { id: "numero", label: "N°" },
              { id: "destination", label: "Destination", hideAt: "sm" },
              { id: "dates", label: "Dates", hideAt: "md" },
              { id: "total", label: "Total", hideAt: "lg" },
              { id: "etape", label: "Statut" },
            ],
            viewAllHref: "/demandes",
            emptyMessage: "Aucune demande pour le moment.",
          },
          cta: {
            label: "Nouvelle demande de déplacement",
            href: "/demandes/nouvelle",
            icon: "plus",
          },
        },
        demandes,
      }
    }
    case "MANAGER": {
      const { demandes, enAttente } = await fetchQueueDemandes(
        role,
        "MANAGER_REVIEW"
      )

      return {
        config: {
          subtitle: "Gérez les demandes de votre équipe",
          statPills: [
            {
              icon: "alert-circle",
              label: "En attente",
              value: enAttente,
              color: "orange",
            },
          ],
          table: {
            title: "Demandes en attente d'approbation",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "date", label: "Date", hideAt: "md" },
              { id: "etape", label: "Statut" },
            ],
            viewAllHref: `/demandes?etape=${queueEtapes(role)[0]}&decision=PENDING`,
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "FINANCE_ADMIN": {
      const { demandes, enAttente } = await fetchQueueDemandes(
        role,
        "FINANCE_REVIEW"
      )

      return {
        config: {
          subtitle: "Administration & Finances",
          statPills: [
            {
              icon: "alert-circle",
              label: "En attente d'approbation",
              value: enAttente,
              color: "orange",
            },
          ],
          table: {
            title: "Demandes en attente d'approbation financière",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "total", label: "Total", hideAt: "md" },
              { id: "etape", label: "Statut" },
            ],
            viewAllHref: `/demandes?etape=${queueEtapes(role)[0]}&decision=PENDING`,
            emptyMessage: "Aucune demande en attente.",
          },
        },
        demandes,
      }
    }
    case "GENERAL_DIRECTION": {
      const committed = committedEtapes(role)
      const [queueResult, budgetTotal] = await Promise.all([
        fetchQueueDemandes(role, "DIRECTION_REVIEW"),
        aggregateBudget(committed),
      ])
      const { demandes, enAttente } = queueResult

      return {
        config: {
          subtitle: "Direction Générale",
          statPills: [
            {
              icon: "alert-circle",
              label: "En attente",
              value: enAttente,
              color: "orange",
            },
            {
              icon: "dollar-sign",
              label: "Budget engagé",
              value: formatCurrency(budgetTotal),
              color: "purple",
            },
          ],
          table: {
            title: "Demandes en attente d'approbation finale",
            columns: [
              { id: "numero", label: "N°" },
              { id: "employe", label: "Employé", hideAt: "sm" },
              { id: "destination", label: "Destination" },
              { id: "total", label: "Total", hideAt: "md" },
              { id: "etape", label: "Statut" },
            ],
            viewAllHref: `/demandes?etape=${queueEtapes(role)[0]}&decision=PENDING`,
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
