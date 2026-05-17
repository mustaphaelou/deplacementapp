import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, STATUT_LABELS } from "@/lib/constants"
import Link from "next/link"
import { FileText, Users, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react"

export default async function RapportsPage() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "FINANCE_ADMIN" && session.user.role !== "GENERAL_DIRECTION")) {
    redirect("/")
  }

  const totalDemandes = await prisma.demandeDeplacement.count({ where: { deletedAt: null } })
  const totalApprouvees = await prisma.demandeDeplacement.count({ where: { statut: "APPROUVEE", deletedAt: null } })
  const totalRejetees = await prisma.demandeDeplacement.count({
    where: { statut: { in: ["REJETEE_MANAGER", "REJETEE_FINANCE", "REJETEE_DIRECTION"] }, deletedAt: null },
  })

  const totalBudget = await prisma.demandeDeplacement.aggregate({
    _sum: { totalEstime: true },
    where: { statut: { in: ["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"] }, deletedAt: null },
  })

  const statutCounts = await Promise.all(
    Object.keys(STATUT_LABELS).map(async (statut) => ({
      statut,
      label: STATUT_LABELS[statut],
      count: await prisma.demandeDeplacement.count({ where: { statut: statut as any, deletedAt: null } }),
    }))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapports</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble des demandes de déplacement</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Total demandes" value={totalDemandes} />
        <StatCard icon={CheckCircle} label="Approuvées" value={totalApprouvees} />
        <StatCard icon={XCircle} label="Rejetées" value={totalRejetees} />
        <StatCard icon={TrendingUp} label="Budget total" value={formatCurrency(Number(totalBudget._sum.totalEstime ?? 0))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition par statut</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statutCounts.map((s) => (
              <div key={s.statut} className="flex items-center justify-between text-sm">
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

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
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
