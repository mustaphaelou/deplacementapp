import { NextResponse } from "next/server"
import type { TransitionCheckReason, WorkflowAction } from "./workflow"

/**
 * The impossible-state refusal shared by the Societe writer and Utilisateur
 * provisioning: no Societe row exists — unreachable after Amorçage (ADR-0018).
 */
export const AUCUNE_SOCIETE_CONFIGUREE = "Aucune société configurée"

export class DemandeNotFoundError extends Error {
  status = 404
  constructor() {
    super("Demande introuvable")
    this.name = "DemandeNotFoundError"
  }
}

export class NotificationNotFoundError extends Error {
  status = 404
  constructor() {
    super("Notification introuvable")
    this.name = "NotificationNotFoundError"
  }
}

export class UnauthorizedActionError extends Error {
  status = 403
  constructor(message = "Action non autorisee") {
    super(message)
    this.name = "UnauthorizedActionError"
  }
}

export class InvalidTransitionError extends Error {
  status = 422
  constructor(message = "Transition invalide") {
    super(message)
    this.name = "InvalidTransitionError"
  }
}

// ─── The refusal vocabulary of the guard (#300) ─────────────────────────────

/**
 * The refusal a reason names: a function of the action, because two of the
 * sentences differ by the action they were written for. A reason therefore does
 * not map to ONE error value — `NOT_OWNER` maps to two — so the reason alone is
 * not a usable key, and this is why the table is keyed by reason and the ROW is
 * a function.
 */
export type RefusTransition = (action: WorkflowAction) => Error

/**
 * Every reason the guard can refuse with, and the refusal each one names.
 *
 * **Why the table is here and not in the workflow module.** The guard module has
 * NO runtime imports today — both of its imports are `import type` — and a
 * React module reads it (`app/(dashboard)/demandes/page.tsx`). `lib/errors.ts`
 * imports `next/server` at runtime, so the dependency may only run this way: the
 * error module reads the guard's reason TYPE and nothing else, which creates no
 * cycle and drags no server-only machinery into a client bundle.
 *
 * **The codes are a wire change for TWO of the four reasons; the other two only
 * changed sentence.** Measured against the base: `TERMINAL` and `NO_EFFECT` —
 * the two about the DemandeDeplacement — moved 403 → 422, which is what they
 * are: an invalid transition, not a permission failure. `WRONG_ROLE` and
 * `NOT_OWNER` keep 403, which is what they mean, since they are the two about
 * who is asking — but their SENTENCES changed too, so every one of the four
 * reasons now answers a different body than it did. Before this table all four
 * answered 403, and three of them answered the same generic sentence: answering
 * « you may not » to a DemandeDeplacement whose Decision is already recorded
 * answers a question nobody asked. A client that branches on the code must read
 * the two numbers apart (403 = « you may not », 422 = invalid transition); a
 * client that reads the body sees a new sentence on all four.
 *
 * The note is repeated where a client can actually reach it: the docblock above
 * is unreachable from a client bundle (`lib/errors.ts` imports `next/server`),
 * so `app/api/demandes/[id]/action/route.ts` carries the same note beside the
 * route. Verified there: the only in-repo client of this route
 * (`hooks/use-demande-actions.ts:27-30`) reads `data.error` and ignores the
 * status code, so nothing in the repository breaks.
 *
 * **Total, with no default and no fall-through.** The `Record` type makes a
 * missing row a compile error and the sweep in `lib/errors.test.ts` makes a
 * FIFTH reason the guard can produce a failing test until it is named here. A
 * `default:` arm or a `??` fallback is a fall-through by another name and is
 * what the old collapse of three reasons into one `UnauthorizedActionError()`
 * already was.
 */
export const REFUS_TRANSITION: Record<TransitionCheckReason, RefusTransition> = {
  // The Decision is already recorded: nothing about the Utilisateur is at
  // fault, the DemandeDeplacement is decided. Reachable at a review Etape where
  // the seat matches (CONTEXT.md — APPROVED/REJECTED/WITHDRAWN are terminal).
  TERMINAL: () => new InvalidTransitionError("La demande a deja ete decidee"),

  // The two ownership sentences, preserved byte-for-byte as the writer composed
  // them, so a Utilisateur refused for ownership reads exactly what they read
  // before the table existed. The action is the only thing that differs.
  NOT_OWNER: (action) =>
    new UnauthorizedActionError(
      "Seul le proprietaire peut " +
        (action === "submit" ? "soumettre" : "retirer") +
        " la demande"
    ),

  // The seat. Phrased about the Etape and the Role's seat AT it, never about the
  // Utilisateur's standing, because the guard reads the seat before the
  // Decision: at FINAL no Role has a seat, so the reason here is WRONG_ROLE for
  // a GENERAL_DIRECTION who has just approved the DemandeDeplacement. A sentence
  // about their permission would be a lie for an authorised reader.
  WRONG_ROLE: () =>
    new UnauthorizedActionError("Aucune transition n'est possible a cette etape pour ce role"),

  // The action does not exist at this Etape: `approuver` or `rejeter` at DRAFT.
  // The Role may well hold the seat here; the Etape simply has no such effect.
  NO_EFFECT: () => new InvalidTransitionError("Cette action n'existe pas a cette etape"),
}

/**
 * The refusal the reason names, ready to throw.
 *
 * Raises nothing and composes nothing: it reads the row off the reason and hands
 * back the error, so the writer's whole remaining job is
 * `throw refusPourTransition(resolution.reason, action)`.
 */
export function refusPourTransition(
  reason: TransitionCheckReason,
  action: WorkflowAction
): Error {
  return REFUS_TRANSITION[reason](action)
}

export class UtilisateurNotFoundError extends Error {
  status = 404
  constructor() {
    super("Utilisateur introuvable")
    this.name = "UtilisateurNotFoundError"
  }
}

export class MotDePasseIncorrectError extends Error {
  status = 400
  constructor() {
    super("Mot de passe actuel incorrect")
    this.name = "MotDePasseIncorrectError"
  }
}

export class EmailChangeRequiresPasswordError extends Error {
  status = 400
  constructor() {
    super("Mot de passe requis pour modifier l'email")
    this.name = "EmailChangeRequiresPasswordError"
  }
}

export class NoProfileUpdateDataError extends Error {
  status = 400
  constructor() {
    super("Aucune donnée à modifier")
    this.name = "NoProfileUpdateDataError"
  }
}

export class AmorcageDejaConfigureError extends Error {
  status = 409
  constructor() {
    super("L'instance est deja configuree")
    this.name = "AmorcageDejaConfigureError"
  }
}

export class AvatarError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "AvatarError"
    this.status = status
  }
}

export class VehiculeNotFoundError extends Error {
  status = 404
  constructor() {
    super("Vehicule introuvable")
    this.name = "VehiculeNotFoundError"
  }
}

export class PdfRenderError extends Error {
  status: number
  constructor(message = "Erreur de génération PDF", status = 500) {
    super(message)
    this.name = "PdfRenderError"
    this.status = status
  }
}

/**
 * The DemandeDeplacement numéro collision: the numéro is allocated by
 * counting the rows and then writing, against a unique index on the numéro,
 * so two creations that interleave read the same count and the database
 * refuses the second. Named so the refusal says what happened instead of
 * answering « Erreur interne » (ADR-0002).
 */
export class NumeroCollisionError extends Error {
  status = 409
  constructor() {
    super("Le numéro de la demande est déjà utilisé")
    this.name = "NumeroCollisionError"
  }
}

/**
 * A Notification write that did not happen, reported by the best-effort entry
 * so the failure leaves the module instead of travelling back to a caller that
 * cannot act on it.
 *
 * The class lives here and not in the Notification module because ADR-0002
 * decides that domain error classes are consolidated in this file, and this one
 * is a domain error by that ADR's own definition: a numeric `.status` plus a
 * message, which is exactly what `handleServiceError` reads.
 */
export class NotificationWriteError extends Error {
  /**
   * A Notification that did not happen is a server-side failure. An error
   * without a numeric status is an unknown error to `handleServiceError`, and it
   * answers « Erreur interne » — the report stops naming its cause. See ADR 0022.
   *
   * Nothing routes this error to `handleServiceError` yet: the module's default
   * reporter logs. The status is the shape the seam will use the day a route
   * wires it up, not one it is used by today.
   */
  status = 500

  /**
   * What the failure is about, in the terms an operator needs.
   *
   * A Utilisateur's id on the usual path, because the question the report
   * answers is « whose receipt is missing ». On a resolve failure it names the
   * whole audience instead — there is no single Utilisateur to name when the
   * query that would have found them never came back — so this is a label, not
   * a foreign key, and nothing may look an id up by it.
   */
  readonly utilisateurId: string

  constructor(utilisateurId: string, cause: unknown) {
    super(
      `Notification write failed for ${utilisateurId}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    )
    this.name = "NotificationWriteError"
    this.utilisateurId = utilisateurId
    this.cause = cause
  }
}

/**
 * The Notification was written; its MAIL was not sent.
 *
 * A separate class rather than a flag on {@link NotificationWriteError}, because
 * the two send an operator to different places. « The row is missing » means
 * looking at the write; « the row is there and the mail is not » means looking at
 * the transport, and an operator sent to the wrong one either way loses the time
 * the report was supposed to save.
 */
export class NotificationMailError extends Error {
  status = 500

  /** The Utilisateur whose Notification was written but not mailed. */
  readonly utilisateurId: string

  constructor(utilisateurId: string, cause: unknown) {
    super(
      `Notification written but not mailed for Utilisateur ${utilisateurId}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    )
    this.name = "NotificationMailError"
    this.utilisateurId = utilisateurId
    this.cause = cause
  }
}

export function handleServiceError(e: unknown): NextResponse {
  if (e && typeof (e as Record<string, unknown>).status === "number") {
    const err = e as Error & { status: number }
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error("Unhandled service error:", e)
  return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
}
