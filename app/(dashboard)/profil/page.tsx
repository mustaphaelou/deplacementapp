import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/constants"

export default async function ProfilPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    include: { departement: true },
  })

  if (!user) redirect("/login")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon Profil</h1>
        <p className="text-sm text-muted-foreground">Informations personnelles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Prénom</p>
              <p className="text-sm font-medium">{user.prenom}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="text-sm font-medium">{user.nom}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Poste</p>
              <p className="text-sm font-medium">{user.poste}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Département</p>
              <p className="text-sm font-medium">{user.departement.nom}</p>
            </div>
            {user.telephone && (
              <div>
                <p className="text-xs text-muted-foreground">Téléphone</p>
                <p className="text-sm font-medium">{user.telephone}</p>
              </div>
            )}
            {user.dateEmbauche && (
              <div>
                <p className="text-xs text-muted-foreground">Date d'embauche</p>
                <p className="text-sm font-medium">{formatDate(user.dateEmbauche)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Membre depuis</p>
              <p className="text-sm font-medium">{formatDate(user.creeLe)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
