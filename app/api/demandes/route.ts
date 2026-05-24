import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { demandeService } from "@/lib/demande-service"
import {
  UnauthorizedActionError,
  DemandeNotFoundError,
  InvalidTransitionError,
} from "@/lib/demande-service"
import { demandeSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const statut = searchParams.get("statut") || undefined
  const recherche = searchParams.get("recherche") || undefined

  const role = auth.user.role
  const userId = auth.user.id

  const where: any = { deletedAt: null }

  if (role === "EMPLOYEE") {
    where.employeId = userId
  }

  if (statut) {
    where.statut = statut
  }

  if (recherche) {
    where.OR = [
      { destination: { contains: recherche, mode: "insensitive" } },
      { numero: { contains: recherche, mode: "insensitive" } },
    ]
  }

  const [demandes, total] = await Promise.all([
    prisma.demandeDeplacement.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        employe: { select: { id: true, prenom: true, nom: true } },
      },
    }),
    prisma.demandeDeplacement.count({ where }),
  ])

  return NextResponse.json({ demandes, total })
}

export const POST = withValidation(demandeSchema, async (req, auth, data, _params) => {
  if (auth.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { action, ...serviceData } = data
  const serviceAction = action === "submit" ? "submit" as const : "create" as const

  try {
    const result = await demandeService.executeAction({
      action: serviceAction,
      data: serviceData,
      actor: { id: auth.id, role: auth.role as any },
    })
    return NextResponse.json({ demande: result.demande })
  } catch (e) {
    if (e instanceof DemandeNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof UnauthorizedActionError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof InvalidTransitionError) return NextResponse.json({ error: e.message }, { status: 422 })
    throw e
  }
})
