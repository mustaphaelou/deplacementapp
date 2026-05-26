"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState, useCallback } from "react"
import { useNotificationContext } from "@/components/notification-context"

export function NotificationBell() {
  const { data: session } = useSession()
  const [count, setCount] = useState(0)
  const { onRefresh } = useNotificationContext()

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/compter")
      if (res.ok) {
        const data = await res.json()
        setCount(data.count)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return

    const interval = setInterval(fetchCount, 120000)
    const unsubscribe = onRefresh(fetchCount)
    queueMicrotask(fetchCount)

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [session, fetchCount, onRefresh])

  if (count === 0) {
    return (
      <Link href="/notifications">
        <Button variant="ghost" size="icon">
          <Bell className="size-5 md:size-4" />
        </Button>
      </Link>
    )
  }

  return (
    <Link href="/notifications" className="relative">
      <Button variant="ghost" size="icon">
        <Bell className="size-5 md:size-4" />
      </Button>
      <span className="bg-destructive text-destructive-foreground pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
        {count > 9 ? "9+" : count}
      </span>
    </Link>
  )
}
