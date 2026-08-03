import { getAuthUser } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import {
  utilisateurService,
  UtilisateurNotFoundError,
} from "@/lib/utilisateur-service"
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

  return <ProfileEdit user={profile} />
}
