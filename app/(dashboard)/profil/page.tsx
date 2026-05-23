import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProfileEdit from "@/components/profile-edit"

export default async function ProfilPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    include: {
      departement: { select: { nom: true } },
      _count: { select: { demandes: true } },
    },
  })

  if (!user) redirect("/login")

  return <ProfileEdit user={user} />
}
