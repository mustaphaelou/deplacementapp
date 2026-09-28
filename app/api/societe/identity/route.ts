import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole } from "@/lib/auth/server"
import { ROLES_MANAGEMENT } from "@/lib/auth/roles"
import { AUCUNE_SOCIETE_CONFIGUREE, handleServiceError } from "@/lib/errors"
import { getSocieteRow } from "@/lib/societe"

// Authenticated Societe management reader: open to the declared set of Roles
// that may manage the application (ROLES_MANAGEMENT, spec #281). ADR-0012 is
// cited here for what it actually decided — the read is scoped to the raw
// stored column values (NOT the composed noreply@<domain> from
// loadSocieteIdentity), so the management form round-trips without corrupting
// DomaineEmail. It decides nothing about Roles.
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const authorized = requireAnyRole(auth.user, ROLES_MANAGEMENT)
  if (!authorized.ok) return authorized.response

  try {
    const row = await getSocieteRow()
    if (!row) {
      return NextResponse.json(
        { error: AUCUNE_SOCIETE_CONFIGUREE },
        { status: 404 }
      )
    }
    return NextResponse.json(row)
  } catch (e) {
    return handleServiceError(e)
  }
}
