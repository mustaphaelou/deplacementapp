import type { StatutDemande, Role } from "@prisma/client"
import type { NotificationEventType } from "./notification-bus"

// ─── New canonical model (internal) ──────────────────────────────────────────

export type Etape =
  | "DRAFT"
  | "MANAGER_REVIEW"
  | "FINANCE_REVIEW"
  | "DIRECTION_REVIEW"
  | "FINAL"

export type Decision = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"

export const PIPELINE: readonly StageDefinition[] = [
  { id: "DRAFT", roleCanAct: "EMPLOYEE", onApprove: "MANAGER_REVIEW" },
  { id: "MANAGER_REVIEW", roleCanAct: "MANAGER", onApprove: "FINANCE_REVIEW" },
  { id: "FINANCE_REVIEW", roleCanAct: "FINANCE_ADMIN", onApprove: "DIRECTION_REVIEW" },
  { id: "DIRECTION_REVIEW", roleCanAct: "GENERAL_DIRECTION", onApprove: "FINAL" },
  { id: "FINAL" },
] as const

export interface StageDefinition {
  id: Etape
  roleCanAct?: Role
  onApprove?: Etape
}

// ─── Legacy compatibility ─────────────────────────────────────────────────────

export function toLegacyStatus(etape: Etape, decision: Decision): StatutDemande {
  if (decision === "WITHDRAWN") return "RETIREE"

  switch (etape) {
    case "DRAFT":
      return "BROUILLON"
    case "MANAGER_REVIEW":
      if (decision === "PENDING") return "SOUMISE"
      if (decision === "REJECTED") return "REJETEE_MANAGER"
      return "APPROUVEE_MANAGER"
    case "FINANCE_REVIEW":
      if (decision === "PENDING") return "APPROUVEE_MANAGER"
      if (decision === "REJECTED") return "REJETEE_FINANCE"
      return "APPROUVEE_FINANCE"
    case "DIRECTION_REVIEW":
      if (decision === "PENDING") return "APPROUVEE_FINANCE"
      if (decision === "REJECTED") return "REJETEE_DIRECTION"
      return "APPROUVEE"
    case "FINAL":
      return "APPROUVEE"
    default:
      return "BROUILLON"
  }
}

export function fromLegacyStatus(statut: StatutDemande): { etape: Etape; decision: Decision } {
  switch (statut) {
    case "BROUILLON":
      return { etape: "DRAFT", decision: "PENDING" }
    case "SOUMISE":
      return { etape: "MANAGER_REVIEW", decision: "PENDING" }
    case "APPROUVEE_MANAGER":
      return { etape: "FINANCE_REVIEW", decision: "PENDING" }
    case "APPROUVEE_FINANCE":
      return { etape: "DIRECTION_REVIEW", decision: "PENDING" }
    case "APPROUVEE":
      return { etape: "FINAL", decision: "APPROVED" }
    case "REJETEE_MANAGER":
      return { etape: "MANAGER_REVIEW", decision: "REJECTED" }
    case "REJETEE_FINANCE":
      return { etape: "FINANCE_REVIEW", decision: "REJECTED" }
    case "REJETEE_DIRECTION":
      return { etape: "DIRECTION_REVIEW", decision: "REJECTED" }
    case "RETIREE":
      return { etape: "DRAFT", decision: "WITHDRAWN" }
    default:
      return { etape: "DRAFT", decision: "PENDING" }
  }
}

// ─── Transition effects (side-effects per transition) ──────────────────────

export interface TransitionEffect {
  from: Etape
  action: WorkflowAction
  to: Etape
  auditAction: string
  notificationEvent: NotificationEventType
  timestamps: string[]
  commentField?: string
  setAssignee?: boolean
}

export const TRANSITION_EFFECTS = [
  {
    from: "DRAFT", action: "submit", to: "MANAGER_REVIEW",
    auditAction: "SOUMISSION", notificationEvent: "DEMANDE_SOUMISE",
    timestamps: ["soumiseLe"],
  },
  {
    from: "MANAGER_REVIEW", action: "approuver", to: "FINANCE_REVIEW",
    auditAction: "APPROBATION_MANAGER", notificationEvent: "DEMANDE_APPROBATION_MANAGER",
    timestamps: ["approuveeManagerLe"], commentField: "commentaireManager", setAssignee: true,
  },
  {
    from: "FINANCE_REVIEW", action: "approuver", to: "DIRECTION_REVIEW",
    auditAction: "APPROBATION_FINANCE", notificationEvent: "DEMANDE_APPROBATION_FINANCE",
    timestamps: ["approuveeFinanceLe"], commentField: "commentaireFinance", setAssignee: true,
  },
  {
    from: "DIRECTION_REVIEW", action: "approuver", to: "FINAL",
    auditAction: "APPROBATION_DIRECTION", notificationEvent: "DEMANDE_APPROBATION_FINALE",
    timestamps: ["approuveeDirectionLe"], commentField: "commentaireDirection", setAssignee: true,
  },
  {
    from: "MANAGER_REVIEW", action: "rejeter", to: "MANAGER_REVIEW",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireManager",
  },
  {
    from: "FINANCE_REVIEW", action: "rejeter", to: "FINANCE_REVIEW",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireFinance",
  },
  {
    from: "DIRECTION_REVIEW", action: "rejeter", to: "DIRECTION_REVIEW",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireDirection",
  },
  {
    from: "DRAFT", action: "retirer", to: "DRAFT",
    auditAction: "RETRAIT", notificationEvent: "DEMANDE_RETIREE",
    timestamps: ["retireeLe"],
  },
] as const satisfies readonly TransitionEffect[]

// ─── Read-model surface (dashboard-facing) ──────────────────────────────────

export type TimestampColumn = (typeof TRANSITION_EFFECTS)[number]["timestamps"][number]

export interface PipelineView {
  queue: Etape[]
  committed: Etape[]
  rollup: Etape[]
}

export const PIPELINE_VIEWS: Record<Role, PipelineView> = {
  EMPLOYEE: {
    queue: ["DRAFT"],
    committed: ["FINAL"],
    rollup: ["DRAFT", "MANAGER_REVIEW", "FINAL"],
  },
  MANAGER: {
    queue: ["MANAGER_REVIEW"],
    committed: ["FINAL"],
    rollup: ["MANAGER_REVIEW"],
  },
  FINANCE_ADMIN: {
    queue: ["FINANCE_REVIEW"],
    committed: ["FINAL"],
    rollup: ["FINANCE_REVIEW"],
  },
  GENERAL_DIRECTION: {
    queue: ["DIRECTION_REVIEW"],
    committed: ["FINAL", "DIRECTION_REVIEW", "FINANCE_REVIEW"],
    rollup: ["DIRECTION_REVIEW"],
  },
}

export function queueEtapes(role: Role): Etape[] {
  return PIPELINE_VIEWS[role].queue
}

export function committedEtapes(role: Role): Etape[] {
  return PIPELINE_VIEWS[role].committed
}

export function rollupEtapes(role: Role): Etape[] {
  return PIPELINE_VIEWS[role].rollup
}

export function resolveStatuts(etapes: Etape[]): StatutDemande[] {
  return etapes.map((e) => toLegacyStatus(e, "PENDING"))
}

/** @deprecated Use queueEtapes() + resolveStatuts() instead */
export function queueStatuts(role: Role): StatutDemande[] {
  return resolveStatuts(queueEtapes(role))
}

/** @deprecated Use committedEtapes() + resolveStatuts() instead */
export function committedStatuts(role: Role): StatutDemande[] {
  return resolveStatuts(committedEtapes(role))
}

/** @deprecated Use rollupEtapes() + resolveStatuts() instead */
export function rollupStatuts(role: Role): StatutDemande[] {
  return resolveStatuts(rollupEtapes(role))
}

export function laneOrderByColumn(etape: Etape): { column: TimestampColumn; direction: "desc" } {
  const effect = TRANSITION_EFFECTS.find((e) => e.to === etape)
  if (!effect) {
    throw new Error(`Aucun effet de transition ne cible l'étape: ${etape}`)
  }
  return { column: effect.timestamps[0], direction: "desc" }
}

// ─── Public API (kept stable) ────────────────────────────────────────────────

export type WorkflowAction = "submit" | "approuver" | "rejeter" | "retirer"

export interface WorkflowResult {
  transition: {
    newStatus: StatutDemande
    fields: Record<string, unknown>
  }
  auditAction: string
  notificationEvent: NotificationEventType
}

export interface AllowedActions {
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canWithdraw: boolean
}

function findEffect(action: WorkflowAction, etape: Etape): TransitionEffect | undefined {
  return TRANSITION_EFFECTS.find((e) => e.from === etape && e.action === action)
}

export function canTransition(role: Role, etape: Etape, action: WorkflowAction, decision?: Decision): boolean {
  const stage = PIPELINE.find((s) => s.id === etape)
  if (!stage || !stage.roleCanAct) return false

  // Terminal decisions block all further transitions
  if (decision === "REJECTED" || decision === "WITHDRAWN" || decision === "APPROVED") return false

  // retirer is only allowed from DRAFT by EMPLOYEE
  if (action === "retirer") {
    return role === "EMPLOYEE" && etape === "DRAFT"
  }

  // submit is only allowed from DRAFT by EMPLOYEE
  if (action === "submit") {
    return role === "EMPLOYEE" && etape === "DRAFT"
  }

  const effect = findEffect(action, etape)
  if (!effect) return false

  return stage.roleCanAct === role
}

export function buildTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  params?: { comment?: string; assigneAId?: string; decision?: Decision }
): WorkflowResult | null {
  const stage = PIPELINE.find((s) => s.id === etape)
  if (!stage || !stage.roleCanAct) return null

  // Terminal decisions block all further transitions
  if (params?.decision === "REJECTED" || params?.decision === "WITHDRAWN" || params?.decision === "APPROVED") return null

  // Guard: retirer only from DRAFT by EMPLOYEE
  if (action === "retirer" && (role !== "EMPLOYEE" || etape !== "DRAFT")) return null

  // Guard: submit only from DRAFT by EMPLOYEE
  if (action === "submit" && (role !== "EMPLOYEE" || etape !== "DRAFT")) return null

  const effect = findEffect(action, etape)
  if (!effect) return null

  // Guard: role must match stage actor
  if (stage.roleCanAct !== role) return null

  let newDecision: Decision
  if (action === "retirer") {
    newDecision = "WITHDRAWN"
  } else if (action === "rejeter") {
    newDecision = "REJECTED"
  } else if (effect.to === "FINAL") {
    newDecision = "APPROVED"
  } else {
    newDecision = "PENDING"
  }

  const newStatus = toLegacyStatus(effect.to, newDecision)

  const fields: Record<string, unknown> = { statut: newStatus }

  for (const ts of effect.timestamps) {
    fields[ts] = new Date()
  }

  if (effect.commentField && params?.comment) {
    fields[effect.commentField] = params.comment
  }

  if (effect.setAssignee && params?.assigneAId) {
    fields.assigneAId = params.assigneAId
  }

  return {
    transition: { newStatus, fields },
    auditAction: effect.auditAction,
    notificationEvent: effect.notificationEvent,
  }
}

export function getAllowedActions(
  role: string,
  userId: string,
  demande: { statut: string; employeId: string }
): AllowedActions {
  const isOwner = demande.employeId === userId
  const r = role as Role
  const { etape, decision } = fromLegacyStatus(demande.statut as StatutDemande)

  return {
    canSubmit: canTransition(r, etape, "submit", decision) && isOwner,
    canApprove: canTransition(r, etape, "approuver", decision),
    canReject: canTransition(r, etape, "rejeter", decision),
    canWithdraw: canTransition(r, etape, "retirer", decision) && isOwner,
  }
}

// ─── Legacy wrappers (zero API change for existing callers) ─────────────────

export function canTransitionFromLegacy(
  role: Role,
  statut: StatutDemande,
  action: WorkflowAction
): boolean {
  const { etape, decision } = fromLegacyStatus(statut)
  return canTransition(role, etape, action, decision)
}

export function buildTransitionFromLegacy(
  role: Role,
  statut: StatutDemande,
  action: WorkflowAction,
  params?: { comment?: string; assigneAId?: string }
): WorkflowResult | null {
  const { etape, decision } = fromLegacyStatus(statut)
  return buildTransition(role, etape, action, { ...params, decision })
}
