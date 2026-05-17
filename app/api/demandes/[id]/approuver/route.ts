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

  const body = await req.json().catch(() => ({}))

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: { employe: { select: { id: true, prenom: true, nom: true } } },
  })
  if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })

  const userId = session.user.id
  const userRole = session.user.role

  if (userRole === "MANAGER" && demande.statut === "SOUMISE") {
    const updated = await prisma.demandeDeplacement.update({
      where: { id },
      data: {
        statut: "APPROUVEE_MANAGER",
        approuveeManagerLe: new Date(),
        assigneAId: userId,
        commentaireManager: body.commentaire || null,
      },
    })
    await ajouterAudit(userId, "APPROBATION_MANAGER", "DemandeDeplacement", id, { numero: demande.numero })
    await notificationBus.dispatch("DEMANDE_APPAROUM_MANAGERIAL", {
      demandeId: demande.id,
      numero: demande.numero,
      employe: { id: demande.employe.id, prenom: demande.employe.prenom, nom: demande.employe.nom },
    })
    return NextResponse.json({ demande: updated })
  }

  if (userRole === "FINANCE_ADMIN" && demande.statut === "APPROUVEE_MANAGER") {
    const updated = await prisma.demandeDeplacement.update({
      where: { id },
      data: {
        statut: "APPROUVEE_FINANCE",
        approuveeFinanceLe: new Date(),
        commentaireFinance: body.commentaire || null,
      },
    })
    await ajouterAudit(userId, "APPROBATION_FINANCE", "DemandeDeplacement", id, { numero: demande.numero })
    await notificationBus.dispatch("DEMANDE_APPAROUM_FINANCE", {
      demandeId: demande.id,
      numero: demande.numero,
      employe: { id: demande.employe.id, prenom: demande.employe.prenom, nom: demande.employe.nom },
    })
    return NextResponse.json({ demande: updated })
  }

  if (userRole === "GENERAL_DIRECTION" && demande.statut === "APPROUVEE_FINANCE") {
    const updated = await prisma.demandeDeplacement.update({
      where: { id },
      data: {
        statut: "APPROUVEE",
        approuveeDirectionLe: new Date(),
        commentaireDirection: body.commentaire || null,
      },
    })
    await ajouterAudit(userId, "APPROBATION_DIRECTION", "DemandeDeplacement", id, { numero: demande.numero })
    await notificationBus.dispatch("DEMANDE_APPAROUM_FINALE", {
      demandeId: demande.id,
      numero: demande.numero,
      employe: { id: demande.employe.id, prenom: demande.employe.prenom, nom: demande.employe.nom },
    })
    return NextResponse.json({ demande: updated })
  }

  return NextResponse.json({ error: "Action non autorisée" }, { status: 403 })
}
