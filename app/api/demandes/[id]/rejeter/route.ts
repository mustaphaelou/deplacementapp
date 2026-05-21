import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ajouterAudit } from "@/lib/audit"
import { notificationBus } from "@/lib/notification-bus"
import { canTransitionFromLegacy, buildTransitionFromLegacy } from "@/lib/workflow"
import type { Role } from "@prisma/client"

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
  const userRole = session.user.role as Role

  if (!canTransitionFromLegacy(userRole, demande.statut, "rejeter")) {
    return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
  }

  const result = buildTransitionFromLegacy(userRole, demande.statut, "rejeter", {
    comment: commentaire,
  })!

  const updated = await prisma.demandeDeplacement.update({
    where: { id },
    data: result.transition.fields as any,
  })

  await ajouterAudit(prisma, userId, result.auditAction, "DemandeDeplacement", id, { numero: demande.numero })
  await notificationBus.dispatch(result.notificationEvent, {
    demandeId: demande.id,
    numero: demande.numero,
    employe: { id: demande.employe.id, prenom: demande.employe.prenom, nom: demande.employe.nom },
  })

  return NextResponse.json({ demande: updated })
}
