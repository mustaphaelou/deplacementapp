import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole, type Role } from "@/lib/auth"
import { utilisateurService } from "@/lib/utilisateur-service"
import { utilisateurSchema, updateUtilisateurSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

const ADMIN_ROLES: Role[] = ["FINANCE_ADMIN", "GENERAL_DIRECTION"]

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const authorized = requireAnyRole(auth.user, ADMIN_ROLES)
  if (!authorized.ok) return authorized.response

  try {
    const users = await utilisateurService.list()
    return NextResponse.json({ users })
  } catch (e) {
    return handleServiceError(e)
  }
}

export const POST = withValidation(utilisateurSchema, async (_req, auth, data) => {
  const authorized = requireAnyRole(auth, ADMIN_ROLES)
  if (!authorized.ok) return authorized.response

  try {
    const user = await utilisateurService.create(
      {
        ...data,
        motDePasse: data.motDePasse || undefined,
        googleAuthEnabled: data.googleAuthEnabled ?? false,
      },
      auth.id
    )
    return NextResponse.json({ user })
  } catch (e) {
    return handleServiceError(e)
  }
})

export const PUT = withValidation(updateUtilisateurSchema, async (_req, auth, data) => {
  const authorized = requireAnyRole(auth, ADMIN_ROLES)
  if (!authorized.ok) return authorized.response

  const { id, ...updateData } = data
  try {
    const user = await utilisateurService.update(
      id,
      { ...updateData, telephone: updateData.telephone || null },
      auth.id
    )
    return NextResponse.json({ user })
  } catch (e) {
    return handleServiceError(e)
  }
})
