import { NextResponse } from "next/server"
import { executeTransition } from "@/lib/demande"
import { actionBodySchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"
import type { Role } from "@/lib/roles"

export const POST = withValidation(actionBodySchema, async (req, auth, data, params: { id: string }) => {
  const { id } = params

  try {
    const comment = "commentaire" in data ? data.commentaire?.trim() : undefined
    const demande = await executeTransition({
      demandeId: id,
      action: data.action,
      actor: { id: auth.id, role: auth.role as Role },
      comment,
    })
    return NextResponse.json({ demande })
  } catch (e) {
    return handleServiceError(e)
  }
})