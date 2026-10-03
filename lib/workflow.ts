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
  /**
   * The Etape this Role WAITS ON — exactly one, and the TYPE says so.
   *
   * This was `Etape[]` and the one-lane fact was a property of the literal
   * below rather than of the interface (#302). Nothing checked it: give a Role
   * a second lane and every link that took `[0]` kept naming the first while
   * the dashboard's queue read and its « En attente » count spanned both. The
   * pill said seven, the link showed three, and nothing failed.
   *
   * `readonly [Etape]` moves the invariant into the type — a second lane is a
   * compile error AT THE DECLARATION rather than a silent truncation at a call
   * site. Deliberately not a runtime assertion: that would be a weaker version
   * of a compile-time fact, costing a branch in code a React module reads and
   * throwing at a moment the interface was supposed to make unreachable.
   *
   * The pairing of one Role to one Etape is fixed by the domain; this change
   * makes no edit to WHICH lane waits on which Role, only to what may be
   * declared there.
   */
  queue: readonly [Etape]
  committed: readonly Etape[]
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

/**
 * The ONE Etape this Role waits on — the single lane, named.
 *
 * The link a Role follows to « the DemandeDeplacements waiting for me » is a
 * function of that Etape, so this is the accessor that composition asks (#303).
 * Before it, every one of those call sites wrote `queueEtapes(role)[0]` by
 * hand: the `[0]` was the only thing expressing « exactly one », which is why
 * the invariant could be violated at the declaration without anything failing.
 *
 * It cannot return `undefined` and cannot be a guess: the declared type admits
 * exactly one Etape, so the first element IS the only element.
 */
export function queueEtape(role: Role): Etape {
  return PIPELINE_VIEWS[role].queue[0]
}

/**
 * The whole queue, for the readers that genuinely SPAN it.
 *
 * This is not duplication of the accessor above — it is one declaration read
 * two ways, and the second is the first widened. The dashboard's queue read
 * (`findPendingByEtapes`) and its per-lane count both take the collection, so
 * dropping it would push the derivation back to the reader — the second home
 * #303 deletes.
 */
export function queueEtapes(role: Role): readonly Etape[] {
  return PIPELINE_VIEWS[role].queue
}

export function committedEtapes(role: Role): readonly Etape[] {
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

/**
 * The one entry into the guard that answers « apply this transition, or say
 * why not ». `ownerMatch` is required and has NO default, deliberately: the
 * old builder's default of `true` was how a caller silently asserted
 * ownership it had never checked (#299).
 *
 * The order of the checks below is the guard's, unchanged: the Etape's seat is
 * read before the Decision, so at FINAL the reason is WRONG_ROLE and never
 * TERMINAL.
 */
export function checkTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  decision: Decision | undefined,
  ownerMatch: boolean
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

// ─── The one way in (#299) ─────────────────────────────────────────────────

export interface TransitionParams {
  /** The Decision the DemandeDeplacement carries today, if any. */
  decision?: Decision
  /**
   * Whether the actor is the DemandeDeplacement's own employee. REQUIRED, with
   * no default: the old builder hardcoded `true`, which let a caller obtain a
   * transition for an action its actor had no ownership of without ever saying
   * so. A required input makes the omission a compile error rather than a
   * silent permission.
   */
  ownerMatch: boolean
  comment?: string
  actorId?: string
}

export type Resolution =
  | { ok: true; transition: WorkflowResult }
  | { ok: false; reason: TransitionCheckReason }

/**
 * The pipeline's one entry into the guard: either the transition to apply, or
 * the reason it will not be applied. There is no third answer.
 *
 * The refusal is a VALUE on the result, so a caller can never confuse it with
 * « nothing to do » — the old builder's `null` covered both. The transition is
 * on the success arm alone, so a caller cannot obtain one the guard refused:
 * the field does not exist to read.
 */
export function resoudreTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  params: TransitionParams
): Resolution {
  const check = checkTransition(
    role,
    etape,
    action,
    params.decision,
    params.ownerMatch
  )
  if (!check.ok) return { ok: false, reason: check.reason }

  const effect = findEffect(action, etape)
  if (!effect) return { ok: false, reason: "NO_EFFECT" }

  return { ok: true, transition: construireTransition(effect, action, params) }
}

/** The fields a transition writes, given an effect the guard already admitted. */
function construireTransition(
  effect: TransitionEffect,
  action: WorkflowAction,
  params: TransitionParams
): WorkflowResult {
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

  if (effect.commentField && params.comment) {
    fields[effect.commentField] = params.comment
  }

  if (effect.setAssignee && params.actorId) {
    fields.assigneAId = params.actorId
  }

  return {
    transition: { newEtape: effect.to, newDecision, fields },
    auditAction: effect.auditAction,
    notificationEvent: effect.notificationEvent,
  }
}

// ─── The creation path's projection (#299) ──────────────────────────────────

/**
 * A DemandeDeplacement is born owned by its creator — the fact `etatCreation`
 * already states. It is a NAMED FACT here, not the unexamined `true` the old
 * builder hardcoded: the creation path knows who owns a row that does not
 * exist yet, because it is about to create it.
 */
const PROPRIETAIRE_A_LA_NAISSANCE = true

/**
 * A projection over the one call, kept for the creation path only.
 *
 * `etatCreation` asks « what does a submitted creation become? » and reads a
 * transition or nothing; it has no owner to compare and no Decision to weigh,
 * because the row it describes is being born. So this projection states the
 * two facts a creation holds (ownership by birth, no Decision yet) and maps the
 * refusal back to `null` — the shape `etatCreation` was written against, and
 * the one its call site keeps using.
 *
 * A caller acting on an EXISTING DemandeDeplacement does not come here: it
 * knows the owner and the Decision, so it calls `resoudreTransition` and reads
 * the reason for itself.
 */
export function buildTransition(
  role: Role,
  etape: Etape,
  action: WorkflowAction,
  params?: { comment?: string; actorId?: string; decision?: Decision }
): WorkflowResult | null {
  const resolution = resoudreTransition(role, etape, action, {
    decision: params?.decision,
    ownerMatch: PROPRIETAIRE_A_LA_NAISSANCE,
    comment: params?.comment,
    actorId: params?.actorId,
  })

  return resolution.ok ? resolution.transition : null
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

/**
 * What the reader asks the one call, four times — once per button the detail
 * page may draw. The ownership fact goes IN as `ownerMatch`, and each verdict
 * is the guard's own answer; there is no `&& isOwner` bolted on afterwards,
 * which is how the reader used to reach an ownership verdict the guard had
 * never been asked for.
 *
 * `role` takes the Role's own vocabulary: the reader is a consumer of the
 * guard, so the cast that used to launder a `string` into a `Role` here is
 * gone, and a caller outside the Role union cannot compile here.
 */
export function getAllowedActions(
  role: Role,
  ownerMatch: boolean,
  demande: { etape: Etape; decision: Decision | undefined }
): AllowedActions {
  const allowed = (action: WorkflowAction): boolean =>
    resoudreTransition(role, demande.etape, action, {
      decision: demande.decision,
      ownerMatch,
    }).ok

  return {
    canSubmit: allowed("submit"),
    canApprove: allowed("approuver"),
    canReject: allowed("rejeter"),
    canWithdraw: allowed("retirer"),
  }
}
