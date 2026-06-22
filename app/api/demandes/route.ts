import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { demandeService } from "@/lib/demande-service"
import { demandeSchema, demandeQuerySchema } from "@/lib/schemas"
import { withValidation, validateQueryParams } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const query = validateQueryParams(demandeQuerySchema, req)
  if (!query.ok) return query.response

  try {
    const result = await demandeService.findMany(auth.user.role, auth.user.id, query.data)
    return NextResponse.json(result)
  } catch (e) {
    return handleServiceError(e)
  }
}

export const POST = withValidation(demandeSchema, async (req, auth, data, _params) => {
  if (auth.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { action, ...serviceData } = data
  const serviceAction = action === "submit" ? "submit" as const : "create" as const

  try {
    const result = await demandeService.executeAction({
      action: serviceAction,
      data: serviceData,
      actor: { id: auth.id, role: auth.role as any },
    })
    return NextResponse.json({ demande: result.demande })
  } catch (e) {
    return handleServiceError(e)
  }
})
