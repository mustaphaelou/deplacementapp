import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { compare, hash } from "bcryptjs"
import { auditBus } from "@/lib/audit-bus"

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

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
  })
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
  }

  const isValid = await compare(currentPassword, user.motDePasse)
  if (!isValid) {
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect" },
      { status: 400 }
    )
  }

  const hashed = await hash(newPassword, 12)

  await prisma.utilisateur.update({
    where: { id: session.user.id },
    data: { motDePasse: hashed },
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "CHANGEMENT_MOT_DE_PASSE",
    entite: "Utilisateur",
    entiteId: user.id,
  })

  return NextResponse.json({ success: true })
}
