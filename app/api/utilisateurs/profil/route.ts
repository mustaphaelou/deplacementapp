import { NextResponse } from "next/server"
import { utilisateurService } from "@/lib/utilisateur-service"
import { profilUpdateSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

export const PUT = withValidation(profilUpdateSchema, async (_req, auth, data) => {
  try {
    const updated = await utilisateurService.updateProfile(auth.id, data)
    return NextResponse.json({ user: updated })
  } catch (e) {
    return handleServiceError(e)
  }
})
