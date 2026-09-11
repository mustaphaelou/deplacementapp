"use client"

import { Badge } from "@/components/ui/badge"
import {
  toDemandePresentation,
  type PresentationTone,
} from "@/lib/demande-presentation"

const variantMap: Record<
  PresentationTone,
  "outline" | "warning" | "success" | "destructive"
> = {
  neutral: "outline",
  pending: "warning",
  success: "success",
  danger: "destructive",
}

export function DemandeStatusBadge({
  etape,
  decision,
}: {
  etape: string
  decision: string
}) {
  const presentation = toDemandePresentation({ etape, decision })
  return (
    <Badge variant={variantMap[presentation.tone]}>
      {presentation.compactLabel}
    </Badge>
  )
}
