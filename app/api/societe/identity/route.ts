import { NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/auth/server"
import { AUCUNE_SOCIETE_CONFIGUREE, handleServiceError } from "@/lib/errors"
import { getSocieteRow } from "@/lib/societe"

// Authenticated Societe management reader (ADR-0012): returns the full Societe
// row including the EmailSender identity fields as their RAW stored column
// values (NOT the composed noreply@<domain> from loadSocieteIdentity), so the
// management form round-trips without corrupting DomaineEmail.
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const authorized = requireRole(auth.user, "FINANCE_ADMIN")
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
