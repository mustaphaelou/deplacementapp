import type { StatutDemande, Role } from "@prisma/client"
import type { NotificationEventType } from "./notification-bus"

// ─── New canonical model (internal) ──────────────────────────────────────────

export type Etape =
  | "DRAFT"
  | "MANAGER_REVIEW"
  | "FINANCE_REVIEW"
  | "DIRECTION_REVIEW"
  | "FINAL"
  | "REJECTED"
  | "WITHDRAWN"

export type Decision = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"

export const PIPELINE: readonly StageDefinition[] = [
  { id: "DRAFT", roleCanAct: "EMPLOYEE", onApprove: "MANAGER_REVIEW" },
  { id: "MANAGER_REVIEW", roleCanAct: "MANAGER", onApprove: "FINANCE_REVIEW", onReject: "REJECTED" },
  { id: "FINANCE_REVIEW", roleCanAct: "FINANCE_ADMIN", onApprove: "DIRECTION_REVIEW", onReject: "REJECTED" },
  { id: "DIRECTION_REVIEW", roleCanAct: "GENERAL_DIRECTION", onApprove: "FINAL", onReject: "REJECTED" },
  { id: "FINAL" },
  { id: "REJECTED" },
  { id: "WITHDRAWN" },
] as const

export interface StageDefinition {
  id: Etape
  roleCanAct?: Role
  onApprove?: Etape
  onReject?: Etape
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
    case "REJECTED":
      return "REJETEE_DIRECTION"
    case "WITHDRAWN":
      return "RETIREE"
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
      return { etape: "REJECTED", decision: "REJECTED" }
    case "REJETEE_FINANCE":
      return { etape: "REJECTED", decision: "REJECTED" }
    case "REJETEE_DIRECTION":
      return { etape: "REJECTED", decision: "REJECTED" }
    case "RETIREE":
      return { etape: "WITHDRAWN", decision: "WITHDRAWN" }
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

export const TRANSITION_EFFECTS: readonly TransitionEffect[] = [
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
    timestamps: ["approuveeFinanceLe"], commentField: "commentaireFinance",
  },
  {
    from: "DIRECTION_REVIEW", action: "approuver", to: "FINAL",
    auditAction: "APPROBATION_DIRECTION", notificationEvent: "DEMANDE_APPROBATION_FINALE",
    timestamps: ["approuveeDirectionLe"], commentField: "commentaireDirection",
  },
  {
    from: "MANAGER_REVIEW", action: "rejeter", to: "REJECTED",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireManager",
  },
  {
    from: "FINANCE_REVIEW", action: "rejeter", to: "REJECTED",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireFinance",
  },
  {
    from: "DIRECTION_REVIEW", action: "rejeter", to: "REJECTED",
    auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"], commentField: "commentaireDirection",
  },
  {
    from: "DRAFT", action: "retirer", to: "WITHDRAWN",
    auditAction: "RETRAIT", notificationEvent: "DEMANDE_RETIREE",
    timestamps: ["retireeLe"],
  },
] as const

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

export function canTransition(role: Role, etape: Etape, action: WorkflowAction): boolean {
  const stage = PIPELINE.find((s) => s.id === etape)
  if (!stage || !stage.roleCanAct) return false

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
  params?: { comment?: string; assigneAId?: string }
): WorkflowResult | null {
  const stage = PIPELINE.find((s) => s.id === etape)
  if (!stage || !stage.roleCanAct) return null

  // Guard: retirer only from DRAFT by EMPLOYEE
  if (action === "retirer" && (role !== "EMPLOYEE" || etape !== "DRAFT")) return null

  // Guard: submit only from DRAFT by EMPLOYEE
  if (action === "submit" && (role !== "EMPLOYEE" || etape !== "DRAFT")) return null

  const effect = findEffect(action, etape)
  if (!effect) return null

  // Guard: role must match stage actor
  if (stage.roleCanAct !== role) return null

  let decision: Decision
  if (action === "retirer") {
    decision = "WITHDRAWN"
  } else if (action === "rejeter") {
    decision = "REJECTED"
  } else if (effect.to === "FINAL") {
    decision = "APPROVED"
  } else {
    decision = "PENDING"
  }

  // For reject, the legacy status is derived from the stage that rejected
  const statusEtape = action === "rejeter" ? effect.from : effect.to
  const newStatus = toLegacyStatus(statusEtape, decision)

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
  const { etape } = fromLegacyStatus(demande.statut as StatutDemande)

  return {
    canSubmit: canTransition(r, etape, "submit") && isOwner,
    canApprove: canTransition(r, etape, "approuver"),
    canReject: canTransition(r, etape, "rejeter"),
    canWithdraw: canTransition(r, etape, "retirer") && isOwner,
  }
}

// ─── Legacy wrappers (zero API change for existing callers) ─────────────────

export function canTransitionFromLegacy(
  role: Role,
  statut: StatutDemande,
  action: WorkflowAction
): boolean {
  const { etape } = fromLegacyStatus(statut)
  return canTransition(role, etape, action)
}

export function buildTransitionFromLegacy(
  role: Role,
  statut: StatutDemande,
  action: WorkflowAction,
  params?: { comment?: string; assigneAId?: string }
): WorkflowResult | null {
  const { etape } = fromLegacyStatus(statut)
  return buildTransition(role, etape, action, params)
}
