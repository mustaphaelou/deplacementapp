import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { utilisateurService, UtilisateurNotFoundError } from "@/lib/utilisateur-service"
import ProfileEdit from "@/components/profile-edit"

export default async function ProfilPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  let user: Awaited<ReturnType<typeof utilisateurService.findProfile>>
  try {
    user = await utilisateurService.findProfile(session.user.id)
  } catch (e) {
    if (e instanceof UtilisateurNotFoundError) redirect("/login")
    throw e
  }

  return <ProfileEdit user={user} />
}
