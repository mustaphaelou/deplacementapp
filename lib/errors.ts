import { NextResponse } from "next/server"

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
