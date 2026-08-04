import { getAuthUser, hasAnyRole } from "@/lib/auth/server"
import { redirect } from "next/navigation"
import { countByEtape, aggregateBudget } from "@/lib/demande"
import type { Etape } from "@/lib/workflow"
import { formatCurrency, ETAPE_LABELS } from "@/lib/constants"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Administration</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  Rapports
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
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
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <BarChart className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              Rapports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vue d&apos;ensemble des demandes de déplacement
            </p>
          </div>
        </div>
      </div>

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
        <DashboardCard icon={XCircle} label="Rejetées" value={0} />
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
