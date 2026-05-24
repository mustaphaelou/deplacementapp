import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { vehiculeService } from "@/lib/vehicule-service"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const vehicules = await vehiculeService.list()

  return NextResponse.json(vehicules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const vehicule = await vehiculeService.create(
    {
      nom: body.nom,
      immatriculation: body.immatriculation,
      disponible: body.disponible ?? true,
    },
    session.user.id
  )

  return NextResponse.json({ vehicule })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const vehicule = await vehiculeService.update(
    body.id,
    {
      nom: body.nom,
      immatriculation: body.immatriculation,
      disponible: body.disponible ?? true,
    },
    session.user.id
  )

  return NextResponse.json({ vehicule })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { id } = await req.json()

  await vehiculeService.delete(id, session.user.id)

  return NextResponse.json({ success: true })
}
