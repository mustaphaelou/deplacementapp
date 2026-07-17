import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { utilisateurService, UtilisateurNotFoundError } from "@/lib/utilisateur-service"
import ProfileEdit from "@/components/profile-edit"

export default async function ProfilPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  try {
    const user = await utilisateurService.findProfile(session.user.id)
    return <ProfileEdit user={user} />
  } catch (e) {
    if (e instanceof UtilisateurNotFoundError) redirect("/login")
    throw e
  }
}
