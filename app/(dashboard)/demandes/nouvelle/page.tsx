"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { DemandeForm } from "@/components/demande-form"
import { VariantA } from "@/components/demande-form-variants/VariantA"
import { VariantB } from "@/components/demande-form-variants/VariantB"
import { VariantC } from "@/components/demande-form-variants/VariantC"
import { PrototypeSwitcher } from "@/components/demande-form-variants/PrototypeSwitcher"

function NouvelleDemandeContent() {
  const searchParams = useSearchParams()
  const variant = searchParams.get("variant") || "original"

  return (
    <div className="w-full min-h-screen pb-20">
      {variant === "original" && (
        <div className="mx-auto max-w-3xl py-8">
          <DemandeForm />
        </div>
      )}
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={["original", "A", "B", "C"]} current={variant} />
    </div>
  )
}

export default function NouvelleDemandePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500">Chargement de l'assistant de déplacement...</div>}>
      <NouvelleDemandeContent />
    </Suspense>
  )
}
