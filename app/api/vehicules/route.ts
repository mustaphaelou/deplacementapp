import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { auditBus } from "@/lib/audit-bus"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const vehicules = await prisma.vehiculeEntreprise.findMany({
    orderBy: { nom: "asc" },
  })

  return NextResponse.json(vehicules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const vehicule = await prisma.vehiculeEntreprise.create({
    data: {
      nom: body.nom,
      immatriculation: body.immatriculation,
      disponible: body.disponible ?? true,
    },
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "CREATION_VEHICULE",
    entite: "VehiculeEntreprise",
    entiteId: vehicule.id,
    details: { nom: vehicule.nom },
  })

  return NextResponse.json({ vehicule })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const vehicule = await prisma.vehiculeEntreprise.update({
    where: { id: body.id },
    data: {
      nom: body.nom,
      immatriculation: body.immatriculation,
      disponible: body.disponible ?? true,
    },
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "MODIFICATION_VEHICULE",
    entite: "VehiculeEntreprise",
    entiteId: vehicule.id,
    details: { nom: vehicule.nom },
  })

  return NextResponse.json({ vehicule })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { id } = await req.json()

  await prisma.vehiculeEntreprise.delete({ where: { id } })
  await auditBus.log({
    utilisateurId: session.user.id,
    action: "SUPPRESSION_VEHICULE",
    entite: "VehiculeEntreprise",
    entiteId: id,
  })

  return NextResponse.json({ success: true })
}
