import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DemandeDetail } from "@/components/demande-detail"
import { notFound } from "next/navigation"
import { getAllowedActions } from "@/lib/workflow"

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: {
      employe: { select: { id: true, prenom: true, nom: true, email: true, poste: true } },
      assigneA: { select: { id: true, prenom: true, nom: true } },
      vehicule: { select: { nom: true, immatriculation: true } },
      documents: { select: { id: true, type: true, creeLe: true } },
    },
  })

  if (!demande || demande.deletedAt) notFound()

  const userRole = session.user.role
  const userId = session.user.id
  const isOwner = demande.employeId === userId

  const { canApprove, canReject, canWithdraw } = getAllowedActions(userRole, userId, {
    statut: demande.statut,
    employeId: demande.employeId,
  })

  return (
    <DemandeDetail
      demande={JSON.parse(JSON.stringify(demande))}
      canApprove={canApprove}
      canReject={canReject}
      canWithdraw={canWithdraw}
      isOwner={isOwner}
      userRole={userRole}
    />
  )
}
