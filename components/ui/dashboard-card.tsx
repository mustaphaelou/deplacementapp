import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface DashboardCardProps {
  icon: LucideIcon
  label: string
  value: string | number
}

export function DashboardCard({ icon: Icon, label, value }: DashboardCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
          <Icon className="text-primary size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
