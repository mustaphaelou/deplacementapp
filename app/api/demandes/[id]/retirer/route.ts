import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ajouterAudit } from "@/lib/audit"
import { notificationBus } from "@/lib/notification-bus"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: { employe: { select: { id: true, prenom: true, nom: true } } },
  })
  if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })

  const userId = session.user.id

  if (demande.employeId !== userId || demande.statut !== "BROUILLON") {
    return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
  }

  const updated = await prisma.demandeDeplacement.update({
    where: { id },
    data: { statut: "RETIREE", retireeLe: new Date() },
  })

  await ajouterAudit(userId, "RETRAIT", "DemandeDeplacement", id, { numero: demande.numero })
  await notificationBus.dispatch("DEMANDE_RETIREE", {
    demandeId: demande.id,
    numero: demande.numero,
    employe: { id: demande.employe.id, prenom: demande.employe.prenom, nom: demande.employe.nom },
    assigneAId: demande.assigneAId,
  })

  return NextResponse.json({ demande: updated })
}
