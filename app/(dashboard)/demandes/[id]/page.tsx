import { auth } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { findById } from "@/lib/demande"
import { DemandeNotFoundError } from "@/lib/errors"
import { DemandeDetail } from "@/components/demande-detail"
import type { DemandeWithRelations } from "@/lib/demande-types"
import type { Role } from "@/lib/auth"
import { notFound } from "next/navigation"
import { getAllowedActions, type Etape, type Decision } from "@/lib/workflow"

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  let demande: DemandeWithRelations
  try {
    demande = await findById(id, {
      id: session.user.id,
      role: session.user.role as Role,
    })
  } catch (e) {
    if (e instanceof DemandeNotFoundError) notFound()
    throw e
  }

  const userRole = session.user.role
  const userId = session.user.id
  const isOwner = demande.employeId === userId
  const { canApprove, canReject, canWithdraw } = getAllowedActions(
    userRole,
    userId,
    {
      etape: demande.etape as Etape,
      decision: demande.decision as Decision,
      employeId: demande.employeId,
    }
  )

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
