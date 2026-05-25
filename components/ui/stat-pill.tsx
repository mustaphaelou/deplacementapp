import type { LucideIcon } from "lucide-react"

interface StatPillProps {
  icon: LucideIcon
  label: string
  value: number | string
  color: "blue" | "green" | "amber" | "orange" | "purple"
}

const colors = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
}

export function StatPill({ icon: Icon, label, value, color }: StatPillProps) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${colors[color]}`}>
      <Icon className="size-3.5" />
      <span className="opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
