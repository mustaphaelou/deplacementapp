import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { DashboardData } from "@/lib/dashboard"
import { formatCurrency, formatDate } from "@/lib/constants"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { FileText, Clock, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

interface EmployeeDashboardProps {
  data: DashboardData
}

export function EmployeeDashboard({ data }: EmployeeDashboardProps) {
  const { stats, demandes } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Bienvenue sur votre espace personnel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <DashboardCard icon={FileText} label="Total demandes" value={stats!.total} />
        <DashboardCard icon={Clock} label="Brouillons" value={stats!.brouillon} />
        <DashboardCard icon={AlertCircle} label="En attente" value={stats!.soumises} />
        <DashboardCard icon={CheckCircle} label="Approuvées" value={stats!.approuvees} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes dernières demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande pour le moment.{" "}
              <Link href="/demandes/nouvelle" className="text-primary underline">
                Créer une nouvelle demande
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">N°</th>
                  <th className="pb-2 font-medium">Destination</th>
                  <th className="pb-2 font-medium">Dates</th>
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
                    <td className="py-2">{d.destination}</td>
                    <td className="py-2">
                      {formatDate(d.dateDepart)} - {formatDate(d.dateRetour)}
                    </td>
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
