import { ETAPE_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "pending" | "success" | "danger"

export function statusOf(d: {
  etape: string
  decision: string
}): { label: string; tone: StatusTone } {
  if (d.decision === "APPROVED") return { label: "Approuvée", tone: "success" }
  if (d.decision === "REJECTED") return { label: "Rejetée", tone: "danger" }
  if (d.decision === "WITHDRAWN") return { label: "Retirée", tone: "neutral" }
  if (d.etape === "FINAL") return { label: "Finalisée", tone: "success" }
  if (d.etape === "DRAFT") return { label: "Brouillon", tone: "neutral" }
  return { label: ETAPE_LABELS[d.etape] ?? d.etape, tone: "pending" }
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-[#F1F1EF] text-[#37352F] dark:bg-zinc-800/60 dark:text-zinc-300",
  pending: "bg-[#FBF0DB] text-[#8B5E0E] dark:bg-amber-900/30 dark:text-amber-400",
  success:
    "bg-[#E5F3EE] text-[#0F6E4F] dark:bg-emerald-900/30 dark:text-emerald-400",
  danger: "bg-[#FBE9E9] text-[#B42318] dark:bg-red-900/30 dark:text-red-400",
}

export function StatusPill({
  label,
  tone,
  className,
}: {
  label: string
  tone: StatusTone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {label}
    </span>
  )
}
