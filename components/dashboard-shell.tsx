"use client"

import { useSyncExternalStore, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { NotificationProvider } from "@/components/notification-context"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Menu as MenuIcon } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  readCollapsed,
  subscribeToCollapse,
  writeCollapsed,
} from "@/lib/sidebar-collapse"
import type { NavItem } from "@/lib/auth"

interface DashboardShellProps {
  navItems: NavItem[]
  societeNom: string
  societeLogoUrl: string | null
  children: React.ReactNode
}

export function DashboardShell({
  navItems,
  societeNom,
  societeLogoUrl,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const collapsed = useSyncExternalStore(
    subscribeToCollapse,
    readCollapsed,
    () => false
  )

  function closeNav() {
    setMobileNavOpen(false)
  }

  return (
    <NotificationProvider>
      <div className="relative flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        {!collapsed && (
          <div className="hidden md:flex md:shrink-0">
            <Sidebar
              items={navItems}
              societeNom={societeNom}
              societeLogoUrl={societeLogoUrl}
              onCollapse={() => writeCollapsed(!collapsed)}
            />
          </div>
        )}

        {/* Collapsed-sidebar restore handle (desktop only) */}
        {collapsed && (
          <div className="absolute top-3 left-3 z-40 hidden md:block">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => writeCollapsed(!collapsed)}
              aria-label="Afficher la barre latérale"
            >
              <MenuIcon className="size-4" />
            </Button>
          </div>
        )}

        {/* Mobile sidebar drawer */}
        <DialogPrimitive.Root
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#F7F6F3] shadow-xl transition-transform duration-300 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full dark:bg-sidebar">
              <Sidebar
                items={navItems}
                closeNav={closeNav}
                societeNom={societeNom}
                societeLogoUrl={societeLogoUrl}
              />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile top bar — drawer toggle only; pages own the rest */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menu"
              className="max-md:min-h-[44px] max-md:min-w-[44px]"
            >
              <MenuIcon className="size-5" />
            </Button>
            <ThemeToggle />
          </div>
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  )
}
