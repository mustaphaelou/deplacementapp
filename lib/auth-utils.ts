import { NextResponse } from "next/server"
import { auth } from "./auth"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  departementId: string
  departement: string
  poste: string
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user) return null
  const u = session.user
  return {
    id: u.id ?? u.email,
    email: u.email ?? "",
    name: u.name ?? "",
    role: u.role ?? "",
    departementId: u.departementId ?? "",
    departement: u.departement ?? "",
    poste: u.poste ?? "",
  }
}

export function getSessionUser(user: { id?: string; email?: string | null; name?: string | null; role?: string; departementId?: string; departement?: string; poste?: string }): AuthUser {
  return {
    id: user.id ?? user.email ?? "",
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role ?? "",
    departementId: user.departementId ?? "",
    departement: user.departement ?? "",
    poste: user.poste ?? "",
  }
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
    }
  }
  return { ok: true, user: getSessionUser(session.user) }
}
