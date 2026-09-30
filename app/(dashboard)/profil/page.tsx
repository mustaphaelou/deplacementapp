import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import {
  utilisateurService,
  UtilisateurNotFoundError,
} from "@/lib/utilisateur-service"
import { countDemandes } from "@/lib/demande/queries"
import ProfileEdit from "@/components/profile-edit"

export default async function ProfilPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  let profile: Awaited<ReturnType<typeof utilisateurService.findProfile>>
  try {
    profile = await utilisateurService.findProfile(user.id)
  } catch (e) {
    if (e instanceof UtilisateurNotFoundError) redirect("/login")
    throw e
  }

  // « Demandes » is a fact about the person, not about their reach: the number
  // of DemandesDeplacement THIS Utilisateur created, whatever their Role. So
  // no etape and no decision filter — a MANAGER sees the same card as an
  // EMPLOYEE — and the read model's own soft-delete exclusion applies.
  //
  // The count is asked here, at the composition point, because the profile read
  // does not own it: counting DemandeDeplacement is the demande read model's
  // job (ADR 0020), and `countDemandes` is its one counting entry point.
  const demandesCount = await countDemandes({ employeId: user.id })

  return <ProfileEdit user={profile} demandesCount={demandesCount} />
}
