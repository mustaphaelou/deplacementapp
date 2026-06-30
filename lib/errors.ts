import { NextResponse } from "next/server"

export class DemandeNotFoundError extends Error {
  status = 404
  constructor() {
    super("Demande introuvable")
    this.name = "DemandeNotFoundError"
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

export function handleServiceError(e: unknown): NextResponse {
  if (e && typeof (e as Record<string, unknown>).status === "number") {
    const err = e as Error & { status: number }
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error("Unhandled service error:", e)
  return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
}
