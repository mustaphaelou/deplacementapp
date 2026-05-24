import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: {
      employe: { select: { id: true, prenom: true, nom: true, email: true, poste: true } },
      assigneA: { select: { id: true, prenom: true, nom: true } },
      vehicule: { select: { nom: true, immatriculation: true } },
      documents: { select: { id: true, type: true, creeLe: true } },
    },
  })

  if (!demande || demande.deletedAt) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 })
  }

  return NextResponse.json({ demande })
}
