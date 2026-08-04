"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  X,
  ChevronDown,
  ChevronsLeft,
  ChevronRight,
  MoreHorizontal,
  BarChart3,
  FileText,
  FilePlus,
  Users,
  Clock,
  DollarSign,
  Car,
  CheckCircle,
  Building,
  type LucideIcon,
} from "lucide-react"
import { Menu } from "@base-ui/react/menu"
import { groupNavItems } from "@/lib/nav-groups"
import { useAuthUser, signOut } from "@/lib/auth/client"
import { ROLE_LABELS } from "@/lib/auth"
import type { NavItem } from "@/lib/auth"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

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
  onCollapse?: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function isActive(pathname: string, item: NavItem) {
  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href))
  )
}

const rowHover =
  "hover:bg-[rgba(55,53,47,0.06)] dark:hover:bg-sidebar-accent/50"

function SidebarRow({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick?: () => void
}) {
  const Icon = iconMap[item.icon]
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex h-7 items-center gap-2 rounded-[3px] px-2 text-sm text-[#37352F] transition-colors dark:text-sidebar-foreground",
        rowHover,
        active && "bg-[rgba(0,0,0,0.03)] dark:bg-sidebar-accent"
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className={cn("flex-1 truncate", active && "font-medium")}>
        {item.label}
      </span>
      <ChevronRight className="size-3.5 text-[#9B9A97] opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

export function Sidebar({
  items,
  societeNom,
  societeLogoUrl,
  closeNav,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuthUser()
  const groups = groupNavItems(items)
  const initial = societeNom?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <aside className="flex h-full w-60 flex-col bg-[#F7F6F3] shadow-[inset_-1px_0_0_0_#f0efed] dark:bg-sidebar">
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1">
        {societeLogoUrl ? (
          <img
            src={societeLogoUrl}
            alt={societeNom}
            className="size-5 rounded-[3px] object-contain"
          />
        ) : (
          <div className="flex size-5 shrink-0 items-center justify-center rounded-[3px] bg-primary text-[11px] font-bold text-primary-foreground">
            {initial}
          </div>
        )}
        <span className="flex-1 truncate text-sm font-medium text-[#37352F] dark:text-sidebar-foreground">
          {societeNom}
        </span>
        <ChevronDown className="size-3 text-[#9B9A97]" />
        <ThemeToggle />
        {closeNav ? (
          <button
            onClick={closeNav}
            aria-label="Fermer le menu"
            className={cn("rounded-[3px] p-1 transition-colors", rowHover)}
          >
            <X className="size-4 text-[#787774]" />
          </button>
        ) : (
          <button
            onClick={onCollapse}
            aria-label="Réduire la barre latérale"
            className={cn("rounded-[3px] p-1 transition-colors", rowHover)}
          >
            <ChevronsLeft className="size-3.5 text-[#787774]" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 py-1">
        {groups.map((group) => (
          <div key={group.section}>
            <div className="mt-3 mb-1 px-2 text-[11px] font-medium tracking-[0.06em] text-[#787774] uppercase dark:text-sidebar-foreground/60">
              {group.section}
            </div>
            {group.items.map((item) => (
              <SidebarRow
                key={item.href}
                item={item}
                active={isActive(pathname, item)}
                onClick={closeNav}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-1.5 border-t border-[#E3E2E0] px-2 py-2 dark:border-sidebar-border">
        <Link
          href="/profil"
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-[3px] px-1 py-0.5 transition-colors", rowHover)}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-[#F1F1EF] text-[11px] font-semibold text-[#37352F] dark:bg-sidebar-accent dark:text-sidebar-foreground">
            {user?.name ? getInitials(user.name) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#37352F] dark:text-sidebar-foreground">
              {user?.name}
            </p>
            <p className="truncate text-xs text-[#9B9A97] dark:text-sidebar-foreground/60">
              {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </p>
          </div>
        </Link>
        <NotificationBell />
        <Menu.Root>
          <Menu.Trigger
            aria-label="Plus d'options"
            className="flex size-6 items-center justify-center rounded-[3px] text-[#9B9A97] transition-colors outline-none hover:bg-[rgba(55,53,47,0.06)] hover:text-[#37352F] focus-visible:ring-2 focus-visible:ring-primary data-[popup-open]:bg-[rgba(55,53,47,0.06)] dark:hover:bg-sidebar-accent/50 dark:hover:text-sidebar-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner className="z-50" side="top" align="end" sideOffset={6}>
              <Menu.Popup className="min-w-36 rounded-[3px] border border-[#E3E2E0] bg-[#FBFBFA] p-1 shadow-lg outline-none">
                <Menu.Item
                  render={<Link href="/profil" />}
                  className="flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-sm text-[#37352F] outline-none select-none hover:bg-[rgba(55,53,47,0.06)] data-[highlighted]:bg-[rgba(55,53,47,0.06)]"
                >
                  Mon profil
                </Menu.Item>
                <Menu.Item
                  onClick={() => signOut()}
                  className="flex h-7 cursor-pointer items-center gap-2 rounded-[3px] px-2 text-sm text-[#37352F] outline-none select-none hover:bg-[rgba(55,53,47,0.06)] data-[highlighted]:bg-[rgba(55,53,47,0.06)]"
                >
                  Déconnexion
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </aside>
  )
}
