import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ajouterAudit } from "@/lib/audit"
import { notifyOnReject } from "@/lib/notifications"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const commentaire = body.commentaire?.trim()

  if (!commentaire) {
    return NextResponse.json({ error: "Le commentaire est obligatoire pour le rejet" }, { status: 400 })
  }

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: { employe: { select: { id: true, prenom: true, nom: true } } },
  })
  if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })

  const userId = session.user.id
  const userRole = session.user.role

  let updateData: any = { rejeteeLe: new Date() }

  if (userRole === "MANAGER" && demande.statut === "SOUMISE") {
    updateData.statut = "REJETEE_MANAGER"
    updateData.commentaireManager = commentaire
  } else if (userRole === "FINANCE_ADMIN" && demande.statut === "APPROUVEE_MANAGER") {
    updateData.statut = "REJETEE_FINANCE"
    updateData.commentaireFinance = commentaire
  } else if (userRole === "GENERAL_DIRECTION" && demande.statut === "APPROUVEE_FINANCE") {
    updateData.statut = "REJETEE_DIRECTION"
    updateData.commentaireDirection = commentaire
  } else {
    return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
  }

  const updated = await prisma.demandeDeplacement.update({ where: { id }, data: updateData })
  await ajouterAudit(userId, "REJET", "DemandeDeplacement", id, { numero: demande.numero })
  await notifyOnReject(demande as any)

  return NextResponse.json({ demande: updated })
}
