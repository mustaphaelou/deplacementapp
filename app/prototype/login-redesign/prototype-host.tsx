"use client"

import { useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const VARIANTS = [
  { key: "A", name: "Split hero" },
  { key: "B", name: "Vertical, social-first" },
  { key: "C", name: "Inverted split, dark glass" },
] as const

export type VariantKey = (typeof VARIANTS)[number]["key"]

function isVariant(s: string | undefined): s is VariantKey {
  return !!s && VARIANTS.some((v) => v.key === s)
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, [contenteditable="true"]')
}

export function PrototypeHost({
  initialVariant,
}: {
  initialVariant: string | undefined
}) {
  const router = useRouter()
  const variant: VariantKey = isVariant(initialVariant) ? initialVariant : "A"

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const idx = VARIANTS.findIndex((v) => v.key === variant)
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goTo(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length].key)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goTo(VARIANTS[(idx + 1) % VARIANTS.length].key)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  function goTo(next: VariantKey) {
    router.replace(`/prototype/login-redesign?variant=${next}`, {
      scroll: false,
    })
  }

  const current = VARIANTS.find((v) => v.key === variant)!

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}

      {process.env.NODE_ENV !== "production" && (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-1 py-1 shadow-lg backdrop-blur"
          role="navigation"
          aria-label="Prototype variants"
        >
          <button
            type="button"
            onClick={() =>
              goTo(
                VARIANTS[
                  (VARIANTS.indexOf(current) - 1 + VARIANTS.length) %
                    VARIANTS.length
                ].key
              )
            }
            className="flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
            aria-label="Previous variant"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2 text-xs font-medium text-slate-600">
            {current.key} — {current.name}
          </span>
          <button
            type="button"
            onClick={() =>
              goTo(
                VARIANTS[(VARIANTS.indexOf(current) + 1) % VARIANTS.length].key
              )
            }
            className="flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
            aria-label="Next variant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </>
  )
}
