"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function NotificationBell() {
  const { data: session } = useSession()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!session?.user?.id) return

    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications/compter")
        if (res.ok) {
          const data = await res.json()
          setCount(data.count)
        }
      } catch {}
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [session])

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
