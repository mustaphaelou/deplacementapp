import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/constants"
import Link from "next/link"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const unreadCount = notifications.filter((n) => !n.lu).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">{unreadCount} non lue(s)</p>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8">
          <Bell className="mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Aucune notification</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 p-4 transition-colors",
                n.lu ? "bg-muted/40 text-muted-foreground/70" : "bg-background",
              )}
            >
              <div
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  n.lu ? "bg-muted-foreground/30" : "bg-primary",
                )}
              />
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm",
                    n.lu ? "font-normal" : "font-semibold text-foreground",
                  )}
                >
                  {n.titre}
                </p>
                <p
                  className={cn(
                    "text-sm",
                    n.lu ? "text-muted-foreground/50" : "text-muted-foreground",
                  )}
                >
                  {n.message}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    n.lu ? "text-muted-foreground/40" : "text-muted-foreground/60",
                  )}
                >
                  {formatDateTime(n.creeLe)}
                </p>
              </div>
              {n.demandeId && (
                <Link
                  href={`/demandes/${n.demandeId}`}
                  className={cn(
                    "shrink-0 text-xs underline",
                    n.lu ? "text-muted-foreground/40" : "text-primary",
                  )}
                >
                  Voir
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
