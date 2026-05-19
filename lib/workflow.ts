import type { StatutDemande, Role } from "@prisma/client"
import type { NotificationEventType } from "./notification-bus"

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

interface TransitionRule {
  from: StatutDemande
  to: StatutDemande
  role: Role
  auditAction: string
  notificationEvent: NotificationEventType
  timestamps: string[]
  commentField?: string
  setAssignee?: boolean
}

const transitions: Record<WorkflowAction, TransitionRule[]> = {
  submit: [
    {
      from: "BROUILLON", to: "SOUMISE", role: "EMPLOYEE",
      auditAction: "SOUMISSION", notificationEvent: "DEMANDE_SOUMISE",
      timestamps: ["soumiseLe"],
    },
  ],
  approuver: [
    {
      from: "SOUMISE", to: "APPROUVEE_MANAGER", role: "MANAGER",
      auditAction: "APPROBATION_MANAGER", notificationEvent: "DEMANDE_APPAROUM_MANAGERIAL",
      timestamps: ["approuveeManagerLe"], commentField: "commentaireManager", setAssignee: true,
    },
    {
      from: "APPROUVEE_MANAGER", to: "APPROUVEE_FINANCE", role: "FINANCE_ADMIN",
      auditAction: "APPROBATION_FINANCE", notificationEvent: "DEMANDE_APPAROUM_FINANCE",
      timestamps: ["approuveeFinanceLe"], commentField: "commentaireFinance",
    },
    {
      from: "APPROUVEE_FINANCE", to: "APPROUVEE", role: "GENERAL_DIRECTION",
      auditAction: "APPROBATION_DIRECTION", notificationEvent: "DEMANDE_APPAROUM_FINALE",
      timestamps: ["approuveeDirectionLe"], commentField: "commentaireDirection",
    },
  ],
  rejeter: [
    {
      from: "SOUMISE", to: "REJETEE_MANAGER", role: "MANAGER",
      auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
      timestamps: ["rejeteeLe"], commentField: "commentaireManager",
    },
    {
      from: "APPROUVEE_MANAGER", to: "REJETEE_FINANCE", role: "FINANCE_ADMIN",
      auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
      timestamps: ["rejeteeLe"], commentField: "commentaireFinance",
    },
    {
      from: "APPROUVEE_FINANCE", to: "REJETEE_DIRECTION", role: "GENERAL_DIRECTION",
      auditAction: "REJET", notificationEvent: "DEMANDE_REJETEE",
      timestamps: ["rejeteeLe"], commentField: "commentaireDirection",
    },
  ],
  retirer: [
    {
      from: "BROUILLON", to: "RETIREE", role: "EMPLOYEE",
      auditAction: "RETRAIT", notificationEvent: "DEMANDE_RETIREE",
      timestamps: ["retireeLe"],
    },
  ],
}

function findRule(action: WorkflowAction, role: Role, from: StatutDemande): TransitionRule | undefined {
  return transitions[action]?.find((t) => t.from === from && t.role === role)
}

export function canTransition(role: Role, from: StatutDemande, action: WorkflowAction): boolean {
  return findRule(action, role, from) !== undefined
}

export function buildTransition(
  role: Role,
  from: StatutDemande,
  action: WorkflowAction,
  params?: { comment?: string; assigneAId?: string }
): WorkflowResult | null {
  const rule = findRule(action, role, from)
  if (!rule) return null

  const fields: Record<string, unknown> = { statut: rule.to }

  for (const ts of rule.timestamps) {
    fields[ts] = new Date()
  }

  if (rule.commentField && params?.comment) {
    fields[rule.commentField] = params.comment
  }

  if (rule.setAssignee && params?.assigneAId) {
    fields.assigneAId = params.assigneAId
  }

  return {
    transition: { newStatus: rule.to, fields },
    auditAction: rule.auditAction,
    notificationEvent: rule.notificationEvent,
  }
}

export function getAllowedActions(
  role: string,
  userId: string,
  demande: { statut: string; employeId: string }
): AllowedActions {
  const isOwner = demande.employeId === userId
  const r = role as Role
  const s = demande.statut as StatutDemande

  return {
    canSubmit: r === "EMPLOYEE" && s === "BROUILLON" && isOwner,
    canApprove: canTransition(r, s, "approuver"),
    canReject: canTransition(r, s, "rejeter"),
    canWithdraw: r === "EMPLOYEE" && s === "BROUILLON" && isOwner,
  }
}
