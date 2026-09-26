"use client"

import { useAuthUser } from "@/lib/auth/client"
import { redirect } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Bell, Eye } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { useNotificationContext } from "@/components/notification-context"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type Notification = {
  id: string
  titre: string
  message: string
  lu: boolean
  creeLe: string
  demandeId: string | null
}

export function NotificationList({
  notifications,
  marking,
  onMarkAsRead,
}: {
  notifications: Notification[]
  marking: Set<string>
  onMarkAsRead: (id: string) => void
}) {
  return (
    <div className="divide-y">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 py-4"
        >
          <div
            className={cn(
              "mt-1.5 size-2 shrink-0 rounded-full",
              n.lu ? "bg-muted-foreground/30" : "bg-primary"
            )}
          />
          <div className="flex-1">
            <p
              className={cn(
                "text-sm",
                n.lu ? "font-normal text-muted-foreground/70" : "font-medium text-foreground"
              )}
            >
              {n.titre}
            </p>
            <p
              className={cn(
                "text-sm",
                n.lu ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              {n.message}
            </p>
            <p
              className={cn(
                "mt-1 text-xs",
                n.lu
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground/60"
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
                onClick={() => onMarkAsRead(n.id)}
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
                  n.lu ? "text-muted-foreground/40" : "text-primary"
                )}
              >
                Voir
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NotificationsPage() {
  const { user } = useAuthUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<Set<string>>(new Set())
  const { refreshBell } = useNotificationContext()

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
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
  }, [userId])

  const markAsRead = useCallback(
    async (id: string) => {
      setMarking((prev) => new Set(prev).add(id))
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lu: true } : n))
      )
      try {
        const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" })
        if (!res.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, lu: false } : n))
          )
        } else {
          refreshBell()
        }
      } catch {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, lu: false } : n))
        )
      } finally {
        setMarking((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [refreshBell]
  )

  if (!user) redirect("/login")

  const unreadCount = notifications.filter((n) => !n.lu).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center justify-between">
          {/* #258: the #254 reference block, verbatim — min-w-0 on the nav and
              the last item, flex-nowrap so the list cannot break across lines,
              truncate on the page to ellipsise. twMerge drops the primitive's
              flex-wrap for flex-nowrap. */}
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem>
                <span>Espace</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="min-w-0 truncate font-medium">
                  Notifications
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mt-6 flex items-center gap-4">
          {/* #258: 40px tile on a phone, 48px from md: up. */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12">
            <Bell className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount} non lue(s)
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8">
          <Bell className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Aucune notification</p>
        </div>
      ) : (
        <NotificationList
          notifications={notifications}
          marking={marking}
          onMarkAsRead={markAsRead}
        />
      )}
    </div>
  )
}
