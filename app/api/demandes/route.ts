import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole, type Role } from "@/lib/auth/server"
import { findMany, createDraft, createAndSubmit } from "@/lib/demande"
import { demandeSchema, demandeQuerySchema } from "@/lib/schemas"
import { withValidation, validateQueryParams } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const query = validateQueryParams(demandeQuerySchema, req)
  if (!query.ok) return query.response
  try {
    const result = await findMany(
      { id: auth.user.id, role: auth.user.role as Role },
      query.data
    )
    return NextResponse.json(result)
  } catch (e) {
    return handleServiceError(e)
  }
}

export const POST = withValidation(
  demandeSchema,
  async (req, auth, data, _params) => {
    const authorized = requireRole(auth, "EMPLOYEE")
    if (!authorized.ok) return authorized.response
    const { action, ...serviceData } = data
    const actor = { id: auth.id, role: auth.role as Role }
    try {
      const demande =
        action === "submit"
          ? await createAndSubmit(serviceData, actor)
          : await createDraft(serviceData, actor)
      return NextResponse.json({ demande })
    } catch (e) {
      return handleServiceError(e)
    }
  }
)
