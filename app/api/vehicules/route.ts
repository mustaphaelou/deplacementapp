import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { vehiculeService } from "@/lib/vehicule-service"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const vehicules = await vehiculeService.list()

  return NextResponse.json(vehicules)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const vehicule = await vehiculeService.create(
    {
      nom: body.nom,
      immatriculation: body.immatriculation,
      disponible: body.disponible ?? true,
    },
    auth.user.id
  )

  return NextResponse.json({ vehicule })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN") {
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
    auth.user.id
  )

  return NextResponse.json({ vehicule })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { id } = await req.json()

  await vehiculeService.delete(id, auth.user.id)

  return NextResponse.json({ success: true })
}
