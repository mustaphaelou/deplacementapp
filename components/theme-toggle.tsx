"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-[3px] text-[#9B9A97] transition-colors outline-none hover:bg-[rgba(55,53,47,0.06)] hover:text-[#37352F] focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-sidebar-accent/50 dark:hover:text-sidebar-foreground",
        className
      )}
    >
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  )
}
