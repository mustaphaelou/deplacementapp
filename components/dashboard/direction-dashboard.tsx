import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { DashboardData } from "@/lib/dashboard"
import { formatCurrency } from "@/lib/constants"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { AlertCircle, TrendingUp } from "lucide-react"
import Link from "next/link"

interface DirectionDashboardProps {
  data: DashboardData
}

export function DirectionDashboard({ data }: DirectionDashboardProps) {
  const { enAttente, budgetTotal, demandes } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord - Direction Générale</h1>
        <p className="text-sm text-muted-foreground">
          Approbations finales et vue d&apos;ensemble
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard
          icon={AlertCircle}
          label="Approbations finales en attente"
          value={enAttente!}
        />
        <DashboardCard
          icon={TrendingUp}
          label="Budget total engagé"
          value={formatCurrency(budgetTotal!)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Demandes en attente d&apos;approbation finale
          </CardTitle>
          <Link href="/demandes?statut=APPROUVEE_FINANCE" className="text-sm text-primary underline">
            Voir tout
          </Link>
        </CardHeader>
        <CardContent>
          {demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande en attente d&apos;approbation finale.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">N°</th>
                  <th className="pb-2 font-medium">Employé</th>
                  <th className="pb-2 font-medium">Destination</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={`/demandes/${d.id}`} className="text-primary underline">
                        {d.numero}
                      </Link>
                    </td>
                    <td className="py-2">
                      {d.employe!.prenom} {d.employe!.nom}
                    </td>
                    <td className="py-2">{d.destination}</td>
                    <td className="py-2">
                      {formatCurrency(Number(d.totalEstime ?? 0))}
                    </td>
                    <td className="py-2">
                      <DemandeStatusBadge statut={d.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
