"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Bell, Eye } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { useNotificationContext } from "@/components/notification-context"

type Notification = {
  id: string
  titre: string
  message: string
  lu: boolean
  creeLe: string
  demandeId: string | null
}

export default function NotificationsPage() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<Set<string>>(new Set())
  const { refreshBell } = useNotificationContext()

  useEffect(() => {
    if (!session?.user) return
    ;(async () => {
      try {
        const res = await fetch("/api/notifications")
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [session])

  const markAsRead = useCallback(async (id: string) => {
    setMarking((prev) => new Set(prev).add(id))
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lu: true } : n)),
    )
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" })
      if (!res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, lu: false } : n)),
        )
      } else {
        refreshBell()
      }
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lu: false } : n)),
      )
    } finally {
      setMarking((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [refreshBell])

  if (!session?.user) redirect("/login")

  const unreadCount = notifications.filter((n) => !n.lu).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">{unreadCount} non lue(s)</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      ) : notifications.length === 0 ? (
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
              <div className="flex items-center gap-2">
                {!n.lu && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => markAsRead(n.id)}
                    disabled={marking.has(n.id)}
                    className="size-7 shrink-0"
                    title="Marquer comme lue"
                  >
                    <Eye className="size-3.5" />
                  </Button>
                )}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
