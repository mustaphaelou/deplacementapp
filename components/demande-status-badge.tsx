"use client"

import { Badge } from "@/components/ui/badge"
import { ETAPE_LABELS } from "@/lib/constants"

const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  DRAFT: "outline",
  MANAGER_REVIEW: "warning",
  FINANCE_REVIEW: "secondary",
  DIRECTION_REVIEW: "secondary",
  FINAL: "success",
}

export function DemandeStatusBadge({ etape }: { etape: string }) {
  return (
    <Badge variant={variantMap[etape] ?? "outline"}>
      {ETAPE_LABELS[etape] ?? etape}
    </Badge>
  )
}
