"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Menu } from "lucide-react"
import { ROLE_LABELS } from "@/lib/roles"
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
  const { data: session } = useSession()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        {onOpenMobileNav && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileNav}
            className="md:hidden max-md:min-h-[44px] max-md:min-w-[44px]"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {session?.user?.name}
        </span>
        <span className="text-muted-foreground/50 text-xs hidden sm:inline">•</span>
        <span className="text-muted-foreground text-xs hidden sm:inline">
          {ROLE_LABELS[session?.user?.role ?? ""] ?? session?.user?.role}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/profil" title="Mon Profil">
          <Avatar className="size-8 cursor-pointer ring-1 ring-border hover:ring-primary transition-all">
            {session?.user?.avatarUrl ? (
              <AvatarImage src={session.user.avatarUrl} alt={session.user.name} />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {session?.user?.name ? getInitials(session.user.name) : "?"}
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
