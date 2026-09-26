import { getAuthUser, hasAnyRole } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { countDemandes, aggregateBudget } from "@/lib/demande"
import { PIPELINE } from "@/lib/workflow"
import { formatCurrency } from "@/lib/constants"
import { ETAPE_LABELS } from "@/lib/demande-presentation"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"
import {
  Download,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  BarChart,
} from "lucide-react"

export default async function RapportsPage() {
  const user = await getAuthUser()
  if (!user || !hasAnyRole(user.role, ["FINANCE_ADMIN", "GENERAL_DIRECTION"])) {
    redirect("/")
  }

  // Stage order is the pipeline definition — never a label map's insertion
  // order.
  const etapes = PIPELINE.map((stage) => stage.id)
  const etapeCounts = await Promise.all(
    etapes.map(async (etape) => ({
      etape,
      label: ETAPE_LABELS[etape],
      count: await countDemandes({ etape }),
    }))
  )

  const totalDemandes = etapeCounts.reduce((sum, s) => sum + s.count, 0)
  const totalApprouvees =
    etapeCounts.find((s) => s.etape === "FINAL")?.count ?? 0
  const totalRejetees = await countDemandes({ decision: "REJECTED" })
  const totalBudget = await aggregateBudget(["FINAL"])

  return (
    <div className="space-y-6">
      {/* #261: the header geometry and the breadcrumb markup live in the
          shared module; the page passes only what varies. */}
      <PageHeader
        crumbs={["Administration", "Rapports"]}
        title="Rapports"
        subtitle="Vue d'ensemble des demandes de déplacement"
        icon={BarChart}
        action={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  render={<Link href="/api/csv" />}
                  nativeButton={false}
                >
                  <Download className="size-4" />
                  CSV
                </Button>
              }
            />
            <TooltipContent>Exporter en CSV</TooltipContent>
          </Tooltip>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          icon={FileText}
          label="Total demandes"
          value={totalDemandes}
        />
        <DashboardCard
          icon={CheckCircle}
          label="Approuvées"
          value={totalApprouvees}
        />
        <DashboardCard icon={XCircle} label="Rejetées" value={totalRejetees} />
        <DashboardCard
          icon={TrendingUp}
          label="Budget total"
          value={formatCurrency(totalBudget)}
        />
      </div>

      <section>
        <h2 className="text-base font-semibold tracking-tight">
          Répartition par étape
        </h2>
        <div className="mt-3 border-y border-border">
          {etapeCounts.map((s) => (
            <div
              key={s.etape}
              className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0"
            >
              <span>{s.label}</span>
              <span className="font-medium tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
