import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DemandeDetail } from "@/components/demande-detail"
import { notFound } from "next/navigation"

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

  let canApprove = false
  let canReject = false
  let canWithdraw = false

  if (userRole === "MANAGER" && demande.statut === "SOUMISE") {
    canApprove = true
    canReject = true
  }
  if (userRole === "FINANCE_ADMIN" && demande.statut === "APPROUVEE_MANAGER") {
    canApprove = true
    canReject = true
  }
  if (userRole === "GENERAL_DIRECTION" && demande.statut === "APPROUVEE_FINANCE") {
    canApprove = true
    canReject = true
  }
  if (
    userRole === "EMPLOYEE" &&
    demande.employeId === userId &&
    demande.statut === "BROUILLON"
  ) {
    canWithdraw = true
  }
  const isOwner = demande.employeId === userId

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
