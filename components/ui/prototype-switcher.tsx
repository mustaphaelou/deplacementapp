"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useCallback } from "react"

interface PrototypeSwitcherProps {
  variants: string[]
  current: string
}

export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (process.env.NODE_ENV === "production") return null

  const currentIndex = variants.indexOf(current)

  const navigate = useCallback(
    (dir: 1 | -1) => {
      const next = (currentIndex + dir + variants.length) % variants.length
      const params = new URLSearchParams(searchParams.toString())
      params.set("variant", variants[next])
      router.replace(`?${params.toString()}`)
    },
    [currentIndex, variants, router, searchParams]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return
      if (e.key === "ArrowLeft") navigate(-1)
      if (e.key === "ArrowRight") navigate(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg text-sm">
      <button
        onClick={() => navigate(-1)}
        className="flex size-6 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Previous variant"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[120px] text-center font-mono text-xs">
        {current} / {variants.length}
      </span>
      <button
        onClick={() => navigate(1)}
        className="flex size-6 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Next variant"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
