import type { PresentationTone } from "@/lib/demande-presentation"
import { cn } from "@/lib/utils"

const TONE_CLASSES: Record<PresentationTone, string> = {
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
  tone: PresentationTone
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
