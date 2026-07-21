import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

export async function GET() {
  const userCount = await prisma.utilisateur.count()
  return NextResponse.json({ setupNeeded: userCount === 0 })
}

export async function POST(req: Request) {
  const userCount = await prisma.utilisateur.count()
  if (userCount > 0) {
    return NextResponse.json({ error: "Un administrateur existe déjà" }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { email, password, nom, prenom } = body

  if (!email || !password || !nom || !prenom) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 })
  }

  const dept = await prisma.departement.findUnique({
    where: { nom: "Direction Générale" },
  })
  if (!dept) {
    return NextResponse.json(
      { error: "Département Direction Générale introuvable — les seeds ont-ils été exécutés ?" },
      { status: 500 }
    )
  }

  const existing = await prisma.utilisateur.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 })
  }

  const hashedPassword = await hash(password, 12)

  await prisma.utilisateur.create({
    data: {
      email,
      motDePasse: hashedPassword,
      nom,
      prenom,
      poste: "Directeur Général",
      role: "GENERAL_DIRECTION",
      departementId: dept.id,
    },
  })

  return NextResponse.json({ success: true })
}
