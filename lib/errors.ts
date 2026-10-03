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
 * Record a service-layer failure on the server, naming its cause.
 *
 * This is the half of {@link handleServiceError} that does not need an HTTP
 * response, split out because a module that reports a failure does not always
 * have a response to return: a best-effort write inside a service resolves
 * normally, and its caller is a background job rather than a route. Before this
 * split, such a module had to call `handleServiceError` and discard the
 * `NextResponse` it built — a response allocated, never sent, and invisible to
 * every assertion except a count of calls.
 *
 * The log is observability, not contract (ADR-0022): a throwing sink must
 * never turn a handled failure into a failed operation.
 */
export function reportServiceError(e: unknown): void {
  console.error("Service error:", e)
}

export function handleServiceError(e: unknown): NextResponse {
  if (e && typeof (e as Record<string, unknown>).status === "number") {
    const err = e as Error & { status: number }
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  reportServiceError(e)
  return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
}
