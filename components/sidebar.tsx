"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { X, BarChart3, FileText, FilePlus, Users, Clock, DollarSign, Car, CheckCircle, Building, type LucideIcon } from "lucide-react"
import type { NavItem } from "@/lib/roles"

const iconMap: Record<string, LucideIcon> = {
  "bar-chart-3": BarChart3,
  "file-text": FileText,
  "file-plus": FilePlus,
  users: Users,
  clock: Clock,
  "dollar-sign": DollarSign,
  car: Car,
  "check-circle": CheckCircle,
  building: Building,
}

interface SidebarProps {
  items: NavItem[]
  societeNom: string
  societeLogoUrl: string | null
  closeNav?: () => void
}

export function Sidebar({ items, societeNom, societeLogoUrl, closeNav }: SidebarProps) {
  const pathname = usePathname()
  const initial = societeNom?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-60 flex-col border-r">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        {societeLogoUrl ? (
          <img
            src={societeLogoUrl}
            alt={societeNom}
            className="size-8 rounded-lg object-contain"
          />
        ) : (
          <div className="bg-primary flex size-8 items-center justify-center rounded-lg text-primary-foreground text-sm font-bold">
            {initial}
          </div>
        )}
        <span className="text-sm font-semibold flex-1 truncate">{societeNom}</span>
        {closeNav && (
          <button
            onClick={closeNav}
            className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none md:hidden"
            aria-label="Fermer le menu"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeNav}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors max-md:min-h-[44px]",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-3 text-center text-xs text-sidebar-foreground/50">
        {societeNom} v1.0
      </div>
    </aside>
  )
}