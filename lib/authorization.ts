import { NextResponse } from "next/server"
import type { AuthUser } from "./auth-utils"
import type { Role } from "./roles"

export type AuthorizationResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export function hasAnyRole(role: string, allowed: readonly Role[]): boolean {
  return allowed.includes(role as Role)
}

export function requireRole(user: AuthUser, requiredRole: Role): AuthorizationResult {
  if (!hasAnyRole(user.role, [requiredRole])) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    }
  }
  return { ok: true }
}

export function requireAnyRole(user: AuthUser, requiredRoles: readonly Role[]): AuthorizationResult {
  if (!hasAnyRole(user.role, requiredRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    }
  }
  return { ok: true }
}
