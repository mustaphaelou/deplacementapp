"use client"

import { useAuthUser, signOut } from "@/lib/auth/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Menu } from "lucide-react"
import { ROLE_LABELS } from "@/lib/auth"
import { NotificationBell } from "@/components/notification-bell"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface NavbarProps {
  onOpenMobileNav?: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function Navbar({ onOpenMobileNav }: NavbarProps) {
  const { user } = useAuthUser()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        {onOpenMobileNav && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileNav}
            className="max-md:min-h-[44px] max-md:min-w-[44px] md:hidden"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user?.name}
        </span>
        <span className="hidden text-xs text-muted-foreground/50 sm:inline">
          •
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/profil" title="Mon Profil">
          <Avatar className="size-8 cursor-pointer ring-1 ring-border transition-all hover:ring-primary">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {user?.name ? getInitials(user.name) : "?"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          title="Déconnexion"
          className="max-md:min-h-[44px] max-md:min-w-[44px]"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
