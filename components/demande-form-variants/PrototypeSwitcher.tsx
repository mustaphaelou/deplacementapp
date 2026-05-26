"use client"

import { useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PrototypeSwitcherProps {
  variants: string[]
  current: string
}

const VARIANT_NAMES: Record<string, string> = {
  original: "Baseline Form",
  A: "A: Single-Page Premium",
  B: "B: Multi-Step Wizard",
  C: "C: Split-Screen Recap",
}

export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Don't show in production builds
  if (process.env.NODE_ENV === "production") {
    return null
  }

  const handleSwitch = (newVariant: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("variant", newVariant)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const cycleNext = () => {
    const idx = variants.indexOf(current)
    const nextVal = variants[(idx + 1) % variants.length]
    handleSwitch(nextVal)
  }

  const cyclePrev = () => {
    const idx = variants.indexOf(current)
    const prevVal = variants[(idx - 1 + variants.length) % variants.length]
    handleSwitch(prevVal)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys when typing in inputs/textareas
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === "ArrowRight") {
        e.preventDefault()
        cycleNext()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        cyclePrev()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [current, variants, searchParams])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 bg-zinc-900/90 dark:bg-zinc-100/95 text-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border border-zinc-700/50 dark:border-zinc-200/50 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={cyclePrev}
        className="p-1 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        title="Précédent (←)"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="flex flex-col items-center min-w-48 text-center px-1">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
          PROTOTYPE UI
        </span>
        <span className="font-semibold text-xs sm:text-sm">
          {VARIANT_NAMES[current] || current}
        </span>
      </div>

      <button
        onClick={cycleNext}
        className="p-1 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        title="Suivant (→)"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
