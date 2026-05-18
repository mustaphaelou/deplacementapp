import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { DashboardData } from "@/lib/dashboard"
import { formatDate } from "@/lib/constants"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

interface ManagerDashboardProps {
  data: DashboardData
}

export function ManagerDashboard({ data }: ManagerDashboardProps) {
  const { enAttente, demandes } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord - Responsable</h1>
        <p className="text-sm text-muted-foreground">Gérez les demandes de votre équipe</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard icon={AlertCircle} label="Demandes en attente" value={enAttente!} />
        <DashboardCard icon={CheckCircle} label="Approuvées ce mois" value="-" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Demandes en attente d&apos;approbation</CardTitle>
          <Link href="/demandes?statut=SOUMISE" className="text-sm text-primary underline">
            Voir tout
          </Link>
        </CardHeader>
        <CardContent>
          {demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">N°</th>
                  <th className="pb-2 font-medium">Employé</th>
                  <th className="pb-2 font-medium">Destination</th>
                  <th className="pb-2 font-medium">Dates</th>
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
                    <td className="py-2">{formatDate(d.dateDepart)}</td>
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
