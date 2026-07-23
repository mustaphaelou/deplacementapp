import { NextResponse } from "next/server"
import { demandeService } from "@/lib/demande/di"
import { actionBodySchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"
import type { Role } from "@prisma/client"

export const POST = withValidation(actionBodySchema, async (req, auth, data, params: { id: string }) => {
  const { id } = params

  try {
    switch (data.action) {
      case "approuver": {
        const result = await demandeService.executeAction({
          action: "approuver",
          demandeId: id,
          actor: { id: auth.id, role: auth.role as Role },
          comment: data.commentaire?.trim(),
        })
        return NextResponse.json({ demande: result.demande })
      }
      case "rejeter": {
        const result = await demandeService.executeAction({
          action: "rejeter",
          demandeId: id,
          actor: { id: auth.id, role: auth.role as Role },
          comment: data.commentaire,
        })
        return NextResponse.json({ demande: result.demande })
      }
      case "retirer": {
        const result = await demandeService.executeAction({
          action: "retirer",
          demandeId: id,
          actor: { id: auth.id, role: auth.role as Role },
        })
        return NextResponse.json({ demande: result.demande })
      }
    }
  } catch (e) {
    return handleServiceError(e)
  }
})
