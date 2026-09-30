import type { Role } from "@/lib/auth"
import type { NotificationEventType } from "./notification-events"

export type Etape =
  "DRAFT" | "MANAGER_REVIEW" | "FINANCE_REVIEW" | "DIRECTION_REVIEW" | "FINAL"

export type Decision = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"

// The terminal Decisions: once recorded, the DemandeDeplacement cannot
// transition any further (CONTEXT.md — Decision). The « pending » predicate
// is the one definition of waiting: PENDING ⟺ non-terminal.
export const TERMINAL_DECISIONS: readonly Decision[] = [
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const

export function isPendingDecision(decision: Decision): boolean {
  return !TERMINAL_DECISIONS.includes(decision)
}

export const PIPELINE: readonly StageDefinition[] = [
  { id: "DRAFT", roleCanAct: "EMPLOYEE" },
  { id: "MANAGER_REVIEW", roleCanAct: "MANAGER" },
  { id: "FINANCE_REVIEW", roleCanAct: "FINANCE_ADMIN" },
  { id: "DIRECTION_REVIEW", roleCanAct: "GENERAL_DIRECTION" },
  { id: "FINAL" },
] as const

export interface StageDefinition {
  id: Etape
  roleCanAct?: Role
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
    from: "DRAFT",
    action: "submit",
    to: "MANAGER_REVIEW",
    auditAction: "SOUMISSION",
    notificationEvent: "DEMANDE_SOUMISE",
    timestamps: ["soumiseLe"],
  },
  {
    from: "MANAGER_REVIEW",
    action: "approuver",
    to: "FINANCE_REVIEW",
    auditAction: "APPROBATION_MANAGER",
    notificationEvent: "DEMANDE_APPROBATION_MANAGER",
    timestamps: ["approuveeManagerLe"],
    commentField: "commentaireManager",
    setAssignee: true,
  },
  {
    from: "FINANCE_REVIEW",
    action: "approuver",
    to: "DIRECTION_REVIEW",
    auditAction: "APPROBATION_FINANCE",
    notificationEvent: "DEMANDE_APPROBATION_FINANCE",
    timestamps: ["approuveeFinanceLe"],
    commentField: "commentaireFinance",
    setAssignee: true,
  },
  {
    from: "DIRECTION_REVIEW",
    action: "approuver",
    to: "FINAL",
    auditAction: "APPROBATION_DIRECTION",
    notificationEvent: "DEMANDE_APPROBATION_FINALE",
    timestamps: ["approuveeDirectionLe"],
    commentField: "commentaireDirection",
    setAssignee: true,
  },
  {
    from: "MANAGER_REVIEW",
    action: "rejeter",
    to: "MANAGER_REVIEW",
    auditAction: "REJET",
    notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"],
    commentField: "commentaireManager",
    setAssignee: true,
  },
  {
    from: "FINANCE_REVIEW",
    action: "rejeter",
    to: "FINANCE_REVIEW",
    auditAction: "REJET",
    notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"],
    commentField: "commentaireFinance",
    setAssignee: true,
  },
  {
    from: "DIRECTION_REVIEW",
    action: "rejeter",
    to: "DIRECTION_REVIEW",
    auditAction: "REJET",
    notificationEvent: "DEMANDE_REJETEE",
    timestamps: ["rejeteeLe"],
    commentField: "commentaireDirection",
    setAssignee: true,
  },
  {
    from: "DRAFT",
    action: "retirer",
    to: "DRAFT",
    auditAction: "RETRAIT",
    notificationEvent: "DEMANDE_RETIREE",
    timestamps: ["retireeLe"],
  },
] as const satisfies readonly TransitionEffect[]

// ─── Read-model surface (dashboard-facing) ──────────────────────────────────

export type TimestampColumn =
  (typeof TRANSITION_EFFECTS)[number]["timestamps"][number]

export interface PipelineView {
  queue: Etape[]
  committed: Etape[]
}

export const PIPELINE_VIEWS: Record<Role, PipelineView> = {
  EMPLOYEE: {
    queue: ["DRAFT"],
    committed: ["FINAL"],
  },
  MANAGER: {
    queue: ["MANAGER_REVIEW"],
    committed: ["FINAL"],
  },
  FINANCE_ADMIN: {
    queue: ["FINANCE_REVIEW"],
    committed: ["FINAL"],
  },
  GENERAL_DIRECTION: {
    queue: ["DIRECTION_REVIEW"],
    committed: ["FINAL", "DIRECTION_REVIEW", "FINANCE_REVIEW"],
  },
}

export function queueEtapes(role: Role): Etape[] {
  return PIPELINE_VIEWS[role].queue
}

export function committedEtapes(role: Role): Etape[] {
  return PIPELINE_VIEWS[role].committed
}

export function enteringEffect<E extends readonly TransitionEffect[]>(
  etape: Etape,
  effects: E
): E[number] | undefined {
  if (etape === "DRAFT") {
    return effects.find((e) => e.from === etape && e.action === "retirer")
  }
  return effects.find((e) => e.to === etape && e.to !== e.from)
}

export function laneOrderByColumn(etape: Etape): {
  column: TimestampColumn
  direction: "desc"
} {
  const effect = enteringEffect(etape, TRANSITION_EFFECTS)
  if (!effect) {
    throw new Error(`Aucun effet de transition ne cible l'étape: ${etape}`)
  }
  return { column: effect.timestamps[0], direction: "desc" }
}

// ─── Public API (kept stable) ────────────────────────────────────────────────

export type WorkflowAction = "submit" | "approuver" | "rejeter" | "retirer"

export interface WorkflowResult {
  transition: {
    newEtape: Etape
    newDecision: Decision
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

function findEffect(
  action: WorkflowAction,
  etape: Etape
): TransitionEffect | undefined {
  return TRANSITION_EFFECTS.find((e) => e.from === etape && e.action === action)
}

// ─── Guard engine (single reason-typed check) ───────────────────────────────

export type TransitionCheckReason =
  | "TERMINAL"
  | "NOT_OWNER"
  | "WRONG_ROLE"
  | "NO_EFFECT"

export function checkTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  decision?: Decision,
  ownerMatch = true
): { ok: true } | { ok: false; reason: TransitionCheckReason } {
  const stage = PIPELINE.find((s) => s.id === etape)
  if (!stage || !stage.roleCanAct) {
    return { ok: false, reason: "WRONG_ROLE" }
  }

  // Terminal decisions block all further transitions
  if (decision && !isPendingDecision(decision)) {
    return { ok: false, reason: "TERMINAL" }
  }

  // retirer and submit are DRAFT-owner actions
  if (action === "retirer" || action === "submit") {
    if (!ownerMatch) return { ok: false, reason: "NOT_OWNER" }
    if (role !== "EMPLOYEE" || etape !== "DRAFT") {
      return { ok: false, reason: "WRONG_ROLE" }
    }
    return { ok: true }
  }

  const effect = findEffect(action, etape)
  if (!effect) return { ok: false, reason: "NO_EFFECT" }

  if (stage.roleCanAct !== role) {
    return { ok: false, reason: "WRONG_ROLE" }
  }

  return { ok: true }
}

export function canTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  decision?: Decision
): boolean {
  return checkTransition(role, etape, action, decision, true).ok
}

export function buildTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  params?: { comment?: string; actorId?: string; decision?: Decision }
): WorkflowResult | null {
  if (!checkTransition(role, etape, action, params?.decision, true).ok) {
    return null
  }

  const effect = findEffect(action, etape)
  if (!effect) return null

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

  const fields: Record<string, unknown> = {
    etape: effect.to,
    decision: newDecision,
  }

  for (const ts of effect.timestamps) {
    fields[ts] = new Date()
  }

  if (effect.commentField && params?.comment) {
    fields[effect.commentField] = params.comment
  }

  if (effect.setAssignee && params?.actorId) {
    fields.assigneAId = params.actorId
  }

  return {
    transition: { newEtape: effect.to, newDecision, fields },
    auditAction: effect.auditAction,
    notificationEvent: effect.notificationEvent,
  }
}

// ─── Creation state (where a DemandeDeplacement is born) ────────────────────

// The Decision a DemandeDeplacement is born with, and the one it keeps while
// it travels: the non-terminal one. « PENDING ⟺ non-terminal » is the rule
// isPendingDecision above states, so the test pins this constant against the
// predicate rather than letting the two drift.
const DECISION_OUVERTURE: Decision = "PENDING"

// A creation that is not a submission records a CREATION and announces
// nothing: the Notification event exists only once the DemandeDeplacement
// leaves the draft lane.
const AUDIT_CREATION = "CREATION"

export interface EtatCreation {
  etape: Etape
  decision: Decision
  champs: Record<string, unknown>
  auditAction: string
  notification: NotificationEventType | null
}

/**
 * The pipeline's answer to « where does a DemandeDeplacement start? ».
 *
 * The opening Etape is the pipeline's first stage and the opening Decision is
 * the non-terminal one, for every Role: a Role creating a DemandeDeplacement
 * does not move where it is born. `soumis` is the only thing that changes the
 * answer, and it does so by being the submit action itself — the same effect,
 * the same Etape, the same timestamp, the same JournalAudit action and the
 * same Notification event that « submit » performs on a row that already
 * exists.
 *
 * `champs` never carries `modifieLe`: the modification timestamp belongs to
 * the creation, not to the pipeline, and is written once (#293).
 */
export function etatCreation(role: Role, soumis: boolean): EtatCreation {
  const ouverture = PIPELINE[0]
  const decision = DECISION_OUVERTURE
  const champs: Record<string, unknown> = { etape: ouverture.id, decision }

  if (!soumis) {
    return {
      etape: ouverture.id,
      decision,
      champs,
      auditAction: AUDIT_CREATION,
      notification: null,
    }
  }

  // A DemandeDeplacement is born owned by its creator, so the Role that may
  // leave the opening Etape is the one the pipeline attributes to it — not the
  // Role of whoever calls the creation.
  const roleProprietaire = ouverture.roleCanAct ?? role
  const transition = buildTransition(
    roleProprietaire,
    ouverture.id,
    "submit"
  )
  if (!transition) {
    throw new Error(`Aucune soumission possible depuis l'etape: ${ouverture.id}`)
  }

  return {
    etape: transition.transition.newEtape,
    decision: transition.transition.newDecision,
    champs: transition.transition.fields,
    auditAction: transition.auditAction,
    notification: transition.notificationEvent,
  }
}

export function getAllowedActions(
  role: string,
  userId: string,
  demande: { etape: Etape; decision: Decision; employeId: string }
): AllowedActions {
  const isOwner = demande.employeId === userId
  const r = role as Role

  return {
    canSubmit:
      canTransition(r, demande.etape, "submit", demande.decision) && isOwner,
    canApprove: canTransition(r, demande.etape, "approuver", demande.decision),
    canReject: canTransition(r, demande.etape, "rejeter", demande.decision),
    canWithdraw:
      canTransition(r, demande.etape, "retirer", demande.decision) && isOwner,
  }
}
