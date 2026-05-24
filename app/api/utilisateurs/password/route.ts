import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { utilisateurService, UtilisateurNotFoundError, MotDePasseIncorrectError } from "@/lib/utilisateur-service"

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Mot de passe actuel et nouveau mot de passe requis" },
      { status: 400 }
    )
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit contenir au moins 6 caractères" },
      { status: 400 }
    )
  }

  try {
    await utilisateurService.changePassword(session.user.id, currentPassword, newPassword)
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
}
