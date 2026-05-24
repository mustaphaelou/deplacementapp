import { NextResponse } from "next/server"
import { utilisateurService } from "@/lib/utilisateur-service"
import { passwordChangeSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

export const PUT = withValidation(passwordChangeSchema, async (_req, auth, data) => {
  try {
    await utilisateurService.changePassword(auth.id, data.currentPassword, data.newPassword)
  } catch (e) {
    return handleServiceError(e)
  }

  return NextResponse.json({ success: true })
})
