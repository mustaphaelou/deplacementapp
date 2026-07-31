import { auth, hasAnyRole } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { countByEtape, aggregateBudget } from "@/lib/demande"
import type { Etape } from "@/lib/workflow"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, ETAPE_LABELS } from "@/lib/constants"
import Link from "next/link"
import { FileText, TrendingUp, CheckCircle, XCircle } from "lucide-react"

export default async function RapportsPage() {
  const session = await auth()
  const userRole = session?.user?.role
  if (!hasAnyRole(userRole ?? "", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])) {
    redirect("/")
  }

  const etapes = Object.keys(ETAPE_LABELS) as Etape[]
  const etapeCounts = await Promise.all(
    etapes.map(async (etape) => ({
      etape,
      label: ETAPE_LABELS[etape],
      count: await countByEtape(etape),
    }))
  )

  const totalDemandes = etapeCounts.reduce((sum, s) => sum + s.count, 0)
  const totalApprouvees =
    etapeCounts.find((s) => s.etape === "FINAL")?.count ?? 0
  const totalBudget = await aggregateBudget(["FINAL"])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble des demandes de déplacement
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Total demandes"
          value={totalDemandes}
        />
        <StatCard
          icon={CheckCircle}
          label="Approuvées"
          value={totalApprouvees}
        />
        <StatCard icon={XCircle} label="Rejetées" value={0} />
        <StatCard
          icon={TrendingUp}
          label="Budget total"
          value={formatCurrency(totalBudget)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par étape</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {etapeCounts.map((s) => (
              <div
                key={s.etape}
                className="flex items-center justify-between text-sm"
              >
                <span>{s.label}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Link
          href="/api/csv"
          className="inline-flex items-center rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <FileText className="mr-2 size-4" />
          Exporter en CSV
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
