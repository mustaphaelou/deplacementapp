import { NextResponse } from "next/server"
import { requireAnyRole } from "@/lib/auth/server"
import { ROLES_MANAGEMENT } from "@/lib/auth/roles"
import { AUCUNE_SOCIETE_CONFIGUREE, handleServiceError } from "@/lib/errors"
import { getSocieteBranding, updateSociete } from "@/lib/societe"
import { societeUpdateSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

// Public Societe reader (ADR-0012): unauthenticated callers — the login page —
// receive the IdentiteVisuelle fields only. EmailSender identity configuration
// (NomExpediteurEmail / DomaineEmail) is never exposed here.
export async function GET() {
  try {
    const branding = await getSocieteBranding()
    if (!branding) {
      return NextResponse.json(
        { error: AUCUNE_SOCIETE_CONFIGUREE },
        { status: 404 }
      )
    }
    return NextResponse.json(branding)
  } catch (e) {
    return handleServiceError(e)
  }
}

// Societe management: the write is open to the declared set of Roles that may
// manage the application (ROLES_MANAGEMENT, spec #281) — it names no Role of its
// own. ADR-0012 is cited here for what it actually decided: the body is
// validated by societeUpdateSchema, and the row + JournalAudit are written in
// one transaction inside updateSociete. It decides nothing about Roles.
export const PATCH = withValidation(
  societeUpdateSchema,
  async (_req, auth, data) => {
    const authorized = requireAnyRole(auth, ROLES_MANAGEMENT)
    if (!authorized.ok) return authorized.response

    try {
      const changes = await updateSociete(data, auth.id)
      return NextResponse.json(changes)
    } catch (e) {
      return handleServiceError(e)
    }
  }
)
