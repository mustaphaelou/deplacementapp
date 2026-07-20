import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface DashboardCardProps {
  icon: LucideIcon
  label: string
  value: string | number
}

export function DashboardCard({ icon: Icon, label, value }: DashboardCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
          <Icon />
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
