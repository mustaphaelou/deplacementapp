import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth/server"
import { handleServiceError } from "@/lib/errors"
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
        { error: "Aucune société configurée" },
        { status: 404 }
      )
    }
    return NextResponse.json(branding)
  } catch (e) {
    return handleServiceError(e)
  }
}

// Societe management (ADR-0012): reserved to FINANCE_ADMIN, body validated by
// societeUpdateSchema, row + JournalAudit written in one transaction inside
// updateSociete.
export const PATCH = withValidation(
  societeUpdateSchema,
  async (_req, auth, data) => {
    const authorized = requireRole(auth, "FINANCE_ADMIN")
    if (!authorized.ok) return authorized.response

    try {
      const changes = await updateSociete(data, auth.id)
      return NextResponse.json(changes)
    } catch (e) {
      return handleServiceError(e)
    }
  }
)
