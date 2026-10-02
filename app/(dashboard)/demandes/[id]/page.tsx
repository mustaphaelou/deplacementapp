import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { findById } from "@/lib/demande"
import { DemandeNotFoundError } from "@/lib/errors"
import { DemandeDetail } from "@/components/demande-detail"
import type { DemandeWithRelations } from "@/lib/demande-types"
import { notFound } from "next/navigation"
import { getAllowedActions } from "@/lib/workflow"

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) redirect("/login")

  let demande: DemandeWithRelations
  try {
    demande = await findById(id, {
      id: user.id,
      // The Role arrives as the union: the seam narrowed its own output in
      // #297, so there is nothing left here to re-assert by hand.
      role: user.role,
    })
  } catch (e) {
    if (e instanceof DemandeNotFoundError) notFound()
    throw e
  }

  const userRole = user.role
  const userId = user.id
  const isOwner = demande.employeId === userId
  // The ownership fact goes in as itself; the verdicts come back from the
  // guard. The reader used to take a `userId` and compare it here, which put
  // the ownership decision on this page rather than in the pipeline (#299).
  const { canApprove, canReject, canWithdraw } = getAllowedActions(
    userRole,
    isOwner,
    {
      etape: demande.etape,
      decision: demande.decision,
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
