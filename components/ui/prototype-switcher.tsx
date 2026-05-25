"use client"

/**
 * PROTOTYPE — Floating variant switcher bar.
 * Do not ship to production.
 * Hidden when NODE_ENV === 'production'.
 */

import { useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

const VARIANTS = [
  { key: "A", name: "Toggle fallback" },
  { key: "B", name: "Region filter pills" },
  { key: "C", name: "Quick-select grid" },
] as const

export type VariantKey = (typeof VARIANTS)[number]["key"]

export function PrototypeSwitcher() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get("variant") ?? "A") as VariantKey

  const goTo = useCallback(
    (key: VariantKey) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("variant", key)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const cycle = useCallback(
    (dir: -1 | 1) => {
      const idx = VARIANTS.findIndex((v) => v.key === current)
      const next = (idx + dir + VARIANTS.length) % VARIANTS.length
      goTo(VARIANTS[next].key)
    },
    [current, goTo]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return
      if (e.key === "ArrowLeft") { e.preventDefault(); cycle(-1) }
      if (e.key === "ArrowRight") { e.preventDefault(); cycle(1) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cycle])

  if (process.env.NODE_ENV === "production") return null

  const idx = VARIANTS.findIndex((v) => v.key === current)
  const variant = VARIANTS[idx]

  return (
    <div className="fixed bottom-4 left-1/2 z-[999] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={() => cycle(-1)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Variant précédent"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          PROTOTYPE{" "}
          <span className="text-foreground font-semibold">{variant.key}</span> —
          <span className="text-foreground"> {variant.name}</span>
        </span>

        <button
          type="button"
          onClick={() => cycle(1)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Variant suivant"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
