import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { demandeService, DemandeNotFoundError } from "@/lib/demande-service"
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

  let demande: any
  try {
    demande = await demandeService.queries.findById(id)
  } catch (e) {
    if (e instanceof DemandeNotFoundError) notFound()
    throw e
  }

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
