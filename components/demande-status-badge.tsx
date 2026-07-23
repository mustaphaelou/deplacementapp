"use client"

import { Badge } from "@/components/ui/badge"
import { STATUT_LABELS } from "@/lib/constants"

const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  BROUILLON: "outline",
  SOUMISE: "warning",
  APPROUVEE_MANAGER: "secondary",
  APPROUVEE_FINANCE: "secondary",
  APPROUVEE: "success",
  REJETEE_MANAGER: "destructive",
  REJETEE_FINANCE: "destructive",
  REJETEE_DIRECTION: "destructive",
  RETIREE: "outline",
}

export function DemandeStatusBadge({ statut }: { statut: string }) {
  return (
    <Badge variant={variantMap[statut] ?? "outline"}>
      {STATUT_LABELS[statut] ?? statut}
    </Badge>
  )
}
