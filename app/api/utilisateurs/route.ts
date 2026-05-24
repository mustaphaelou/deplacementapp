import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { utilisateurService } from "@/lib/utilisateur-service"
import { utilisateurSchema, updateUtilisateurSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

const ADMIN_ROLES = ["FINANCE_ADMIN", "GENERAL_DIRECTION"]

function checkAdminRole(role: string): NextResponse | null {
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }
  return null
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const forbidden = checkAdminRole(auth.user.role)
  if (forbidden) return forbidden

  const users = await utilisateurService.list()

  return NextResponse.json({ users })
}

export const POST = withValidation(utilisateurSchema, async (_req, auth, data) => {
  const forbidden = checkAdminRole(auth.role)
  if (forbidden) return forbidden

  const user = await utilisateurService.create(
    { ...data, motDePasse: data.motDePasse || "password123" },
    auth.id
  )

  return NextResponse.json({ user })
})

export const PUT = withValidation(updateUtilisateurSchema, async (_req, auth, data) => {
  const forbidden = checkAdminRole(auth.role)
  if (forbidden) return forbidden

  const { id, ...updateData } = data
  const user = await utilisateurService.update(
    id,
    { ...updateData, telephone: updateData.telephone || null },
    auth.id
  )

  return NextResponse.json({ user })
})
