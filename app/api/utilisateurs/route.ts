import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { utilisateurService } from "@/lib/utilisateur-service"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN" && auth.user.role !== "GENERAL_DIRECTION") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const users = await utilisateurService.list()

  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN" && auth.user.role !== "GENERAL_DIRECTION") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const user = await utilisateurService.create(
    {
      email: body.email,
      motDePasse: body.motDePasse || "password123",
      nom: body.nom,
      prenom: body.prenom,
      poste: body.poste,
      role: body.role,
      departementId: body.departementId,
      telephone: body.telephone,
    },
    auth.user.id
  )

  return NextResponse.json({ user })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  if (auth.user.role !== "FINANCE_ADMIN" && auth.user.role !== "GENERAL_DIRECTION") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()

  const user = await utilisateurService.update(
    body.id,
    {
      email: body.email,
      nom: body.nom,
      prenom: body.prenom,
      poste: body.poste,
      role: body.role,
      departementId: body.departementId,
      telephone: body.telephone || null,
      motDePasse: body.motDePasse,
    },
    auth.user.id
  )

  return NextResponse.json({ user })
}
