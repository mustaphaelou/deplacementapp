"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SURFACES,
  VARIANTS,
  VARIANT_NAMES,
  type Surface,
  type VariantKey,
} from "./prototype-host"

interface PrototypeSwitcherProps {
  variant: VariantKey
  surface: Surface
  onVariant: (v: VariantKey) => void
  onSurface: (s: Surface) => void
}

export function PrototypeSwitcher({
  variant,
  surface,
  onVariant,
  onSurface,
}: PrototypeSwitcherProps) {
  const idx = VARIANTS.indexOf(variant)
  const cycle = (dir: 1 | -1) =>
    onVariant(VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length])

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-zinc-100 shadow-2xl backdrop-blur">
      <span className="mr-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-wide text-zinc-900 uppercase">
        Prototype
      </span>
      <button
        aria-label="Variante précédente"
        onClick={() => cycle(-1)}
        className="rounded-full p-1.5 transition-colors hover:bg-zinc-700"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="min-w-40 text-center font-medium">
        {variant} — {VARIANT_NAMES[variant]}
      </span>
      <button
        aria-label="Variante suivante"
        onClick={() => cycle(1)}
        className="rounded-full p-1.5 transition-colors hover:bg-zinc-700"
      >
        <ChevronRight className="size-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-zinc-700" />
      <div className="flex rounded-full bg-zinc-800 p-0.5">
        {SURFACES.map((s) => (
          <button
            key={s.key}
            onClick={() => onSurface(s.key)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              surface === s.key
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "text-zinc-300 hover:text-white"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <kbd className="hidden text-[10px] text-zinc-500 lg:inline">← →</kbd>
    </div>
  )
}
