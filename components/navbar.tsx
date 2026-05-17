"use client"

"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { ROLE_LABELS } from "@/lib/roles"
import { NotificationBell } from "@/components/notification-bell"

export function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {session?.user?.name}
        </span>
        <span className="text-muted-foreground/50 text-xs">•</span>
        <span className="text-muted-foreground text-xs">
          {ROLE_LABELS[(session?.user as any)?.role ?? ""] ?? (session?.user as any)?.role}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          title="Déconnexion"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
