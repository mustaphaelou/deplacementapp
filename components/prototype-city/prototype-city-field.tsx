"use client"

/**
 * PROTOTYPE — Switcher that renders one of 3 destination field variants.
 * Controlled by ?variant=A|B|C search param.
 * Do not ship to production.
 */

import { useSearchParams } from "next/navigation"
import { VariantA } from "./variant-a-toggle"
import { VariantB } from "./variant-b-filter"
import { VariantC } from "./variant-c-quickselect"

interface PrototypeCityFieldProps {
  value?: string
  onValueChange?: (value: string | null) => void
  error?: string
  id?: string
}

export function PrototypeCityField(props: PrototypeCityFieldProps) {
  const searchParams = useSearchParams()
  const variant = searchParams.get("variant") ?? "A"

  switch (variant) {
    case "B":
      return <VariantB {...props} />
    case "C":
      return <VariantC {...props} />
    default:
      return <VariantA {...props} />
  }
}
