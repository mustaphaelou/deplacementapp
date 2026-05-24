import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { auditBus } from "@/lib/audit-bus"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "FINANCE_ADMIN" && session.user.role !== "GENERAL_DIRECTION")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const users = await prisma.utilisateur.findMany({
    include: { departement: { select: { id: true, nom: true } } },
    orderBy: { nom: "asc" },
  })

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "FINANCE_ADMIN" && session.user.role !== "GENERAL_DIRECTION")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const hashedPassword = await hash(body.motDePasse || "password123", 12)

  const user = await prisma.utilisateur.create({
    data: {
      email: body.email,
      motDePasse: hashedPassword,
      nom: body.nom,
      prenom: body.prenom,
      poste: body.poste,
      role: body.role,
      departementId: body.departementId,
      telephone: body.telephone || null,
    },
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "CREATION_UTILISATEUR",
    entite: "Utilisateur",
    entiteId: user.id,
    details: { email: user.email },
  })

  return NextResponse.json({ user })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "FINANCE_ADMIN" && session.user.role !== "GENERAL_DIRECTION")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const updateData: any = {
    email: body.email,
    nom: body.nom,
    prenom: body.prenom,
    poste: body.poste,
    role: body.role,
    departementId: body.departementId,
    telephone: body.telephone || null,
  }

  if (body.motDePasse) {
    updateData.motDePasse = await hash(body.motDePasse, 12)
  }

  const user = await prisma.utilisateur.update({
    where: { id: body.id },
    data: updateData,
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "MODIFICATION_UTILISATEUR",
    entite: "Utilisateur",
    entiteId: user.id,
    details: { email: user.email },
  })

  return NextResponse.json({ user })
}
