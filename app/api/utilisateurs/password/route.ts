import { NextResponse } from "next/server"
import { utilisateurService, UtilisateurNotFoundError, MotDePasseIncorrectError } from "@/lib/utilisateur-service"
import { passwordChangeSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

export const PUT = withValidation(passwordChangeSchema, async (_req, auth, data) => {
  try {
    await utilisateurService.changePassword(auth.id, data.currentPassword, data.newPassword)
  } catch (err) {
    if (err instanceof UtilisateurNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof MotDePasseIncorrectError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  return NextResponse.json({ success: true })
})
