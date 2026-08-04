"use client"

import { VariantA } from "./variant-a"

export const SURFACES = [
  { key: "login", label: "Connexion" },
  { key: "liste", label: "Liste" },
  { key: "formulaire", label: "Formulaire" },
] as const

export type Surface = (typeof SURFACES)[number]["key"]

function isSurface(s: string | undefined): s is Surface {
  return !!s && SURFACES.some((x) => x.key === s)
}

export function PrototypeHost({
  initialSurface,
}: {
  initialSurface: string | undefined
}) {
  const surface: Surface = isSurface(initialSurface) ? initialSurface : "login"
  const activeNav =
    surface === "formulaire" ? "Nouvelle Demande" : "Mes Demandes"

  return (
    <div className="min-h-dvh bg-white">
      <VariantA surface={surface} activeNav={activeNav} />
    </div>
  )
}
