"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"
import { PrototypeSwitcher } from "./prototype-switcher"

export const VARIANTS = ["A", "B", "C"] as const
export type VariantKey = (typeof VARIANTS)[number]

export const VARIANT_NAMES: Record<VariantKey, string> = {
  A: "Notion classique",
  B: "Marque & cartes",
  C: "Document & rail",
}

export const SURFACES = [
  { key: "login", label: "Connexion" },
  { key: "liste", label: "Liste" },
  { key: "formulaire", label: "Formulaire" },
] as const

export type Surface = (typeof SURFACES)[number]["key"]

function isVariant(v: string | undefined): v is VariantKey {
  return !!v && (VARIANTS as readonly string[]).includes(v)
}

function isSurface(s: string | undefined): s is Surface {
  return !!s && SURFACES.some((x) => x.key === s)
}

export function PrototypeHost({
  initialVariant,
  initialSurface,
}: {
  initialVariant: string | undefined
  initialSurface: string | undefined
}) {
  const router = useRouter()
  const variant: VariantKey = isVariant(initialVariant) ? initialVariant : "A"
  const surface: Surface = isSurface(initialSurface) ? initialSurface : "login"

  const go = useCallback(
    (v: VariantKey, s: Surface) => {
      router.replace(`/prototype/notion-redesign?variant=${v}&surface=${s}`)
    },
    [router]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      e.preventDefault()
      const idx = VARIANTS.indexOf(variant)
      const next =
        e.key === "ArrowRight"
          ? VARIANTS[(idx + 1) % VARIANTS.length]
          : VARIANTS[(idx + VARIANTS.length - 1) % VARIANTS.length]
      go(next, surface)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [variant, surface, go])

  const activeNav =
    surface === "formulaire" ? "Nouvelle Demande" : "Mes Demandes"

  return (
    <div className="min-h-dvh bg-white">
      {variant === "A" && <VariantA surface={surface} activeNav={activeNav} />}
      {variant === "B" && <VariantB surface={surface} activeNav={activeNav} />}
      {variant === "C" && <VariantC surface={surface} activeNav={activeNav} />}
      {process.env.NODE_ENV !== "production" && (
        <PrototypeSwitcher
          variant={variant}
          surface={surface}
          onVariant={(v) => go(v, surface)}
          onSurface={(s) => go(variant, s)}
        />
      )}
    </div>
  )
}
