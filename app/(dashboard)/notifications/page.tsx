import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/constants"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell } from "lucide-react"

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const notifications = await prisma.notification.findMany({
    where: { utilisateurId: session.user.id },
    orderBy: { creeLe: "desc" },
    take: 50,
  })

  await prisma.notification.updateMany({
    where: { utilisateurId: session.user.id, lu: false },
    data: { lu: true },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          {notifications.filter((n) => !n.lu).length} non lue(s)
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Bell className="mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 border-b p-4 last:border-0 ${!n.lu ? "bg-muted/20" : ""}`}
              >
                <div className={`mt-1 size-2 shrink-0 rounded-full ${!n.lu ? "bg-primary" : "bg-transparent"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.titre}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">{formatDateTime(n.creeLe)}</p>
                </div>
                {n.demandeId && (
                  <Link
                    href={`/demandes/${n.demandeId}`}
                    className="text-xs text-primary underline shrink-0"
                  >
                    Voir
                  </Link>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
