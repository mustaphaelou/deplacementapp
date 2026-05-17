import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { formatCurrency, formatDate, STATUT_LABELS } from "@/lib/constants"
import Link from "next/link"
import { FileText, Users, CheckCircle, Clock, AlertCircle, TrendingUp } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = session.user.role
  const userId = session.user.id

  if (role === "EMPLOYEE") {
    const demandes = await prisma.demandeDeplacement.findMany({
      where: { employeId: userId, deletedAt: null },
      orderBy: { creeLe: "desc" },
      take: 5,
    })

    const stats = {
      total: await prisma.demandeDeplacement.count({ where: { employeId: userId, deletedAt: null } }),
      brouillon: await prisma.demandeDeplacement.count({ where: { employeId: userId, statut: "BROUILLON", deletedAt: null } }),
      soumises: await prisma.demandeDeplacement.count({ where: { employeId: userId, statut: "SOUMISE", deletedAt: null } }),
      approuvees: await prisma.demandeDeplacement.count({ where: { employeId: userId, statut: "APPROUVEE", deletedAt: null } }),
    }

    return <EmployeeDashboard stats={stats} demandes={demandes} />
  }

  if (role === "MANAGER") {
    const enAttente = await prisma.demandeDeplacement.count({
      where: { statut: "SOUMISE", deletedAt: null },
    })

    const demandes = await prisma.demandeDeplacement.findMany({
      where: { statut: "SOUMISE", deletedAt: null },
      orderBy: { soumiseLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    return <ManagerDashboard enAttente={enAttente} demandes={demandes} />
  }

  if (role === "FINANCE_ADMIN") {
    const enAttente = await prisma.demandeDeplacement.count({
      where: { statut: "APPROUVEE_MANAGER", deletedAt: null },
    })

    const demandes = await prisma.demandeDeplacement.findMany({
      where: { statut: "APPROUVEE_MANAGER", deletedAt: null },
      orderBy: { approuveeManagerLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    return <FinanceDashboard enAttente={enAttente} demandes={demandes} />
  }

  if (role === "GENERAL_DIRECTION") {
    const enAttente = await prisma.demandeDeplacement.count({
      where: { statut: "APPROUVEE_FINANCE", deletedAt: null },
    })

    const totalMois = await prisma.demandeDeplacement.aggregate({
      _sum: { totalEstime: true },
      where: {
        statut: { in: ["APPROUVEE", "APPROUVEE_FINANCE", "APPROUVEE_MANAGER"] },
        deletedAt: null,
      },
    })

    const demandes = await prisma.demandeDeplacement.findMany({
      where: { statut: "APPROUVEE_FINANCE", deletedAt: null },
      orderBy: { approuveeFinanceLe: "desc" },
      take: 10,
      include: { employe: { select: { prenom: true, nom: true } } },
    })

    return <DirectionDashboard enAttente={enAttente} totalBudget={Number(totalMois._sum.totalEstime ?? 0)} demandes={demandes} />
  }

  redirect("/login")
}

function EmployeeDashboard({ stats, demandes }: { stats: any; demandes: any[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Bienvenue sur votre espace personnel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <DashboardCard icon={FileText} label="Total demandes" value={stats.total} />
        <DashboardCard icon={Clock} label="Brouillons" value={stats.brouillon} />
        <DashboardCard icon={AlertCircle} label="En attente" value={stats.soumises} />
        <DashboardCard icon={CheckCircle} label="Approuvées" value={stats.approuvees} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes dernières demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande pour le moment.{' '}
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
                    <td className="py-2">{formatDate(d.dateDepart)} - {formatDate(d.dateRetour)}</td>
                    <td className="py-2">{formatCurrency(Number(d.totalEstime ?? 0))}</td>
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

function ManagerDashboard({ enAttente, demandes }: { enAttente: number; demandes: any[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord - Responsable</h1>
        <p className="text-sm text-muted-foreground">Gérez les demandes de votre équipe</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard icon={AlertCircle} label="Demandes en attente" value={enAttente} />
        <DashboardCard icon={CheckCircle} label="Approuvées ce mois" value="-" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Demandes en attente d'approbation</CardTitle>
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
                    <td className="py-2">{d.employe.prenom} {d.employe.nom}</td>
                    <td className="py-2">{d.destination}</td>
                    <td className="py-2">{formatDate(d.dateDepart)}</td>
                    <td className="py-2"><DemandeStatusBadge statut={d.statut} /></td>
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

function FinanceDashboard({ enAttente, demandes }: { enAttente: number; demandes: any[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord - Finance</h1>
        <p className="text-sm text-muted-foreground">Approbations budgétaires</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard icon={AlertCircle} label="En attente d'approbation" value={enAttente} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Demandes en attente d'approbation financière</CardTitle>
          <Link href="/demandes?statut=APPROUVEE_MANAGER" className="text-sm text-primary underline">
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
                    <td className="py-2">{d.employe.prenom} {d.employe.nom}</td>
                    <td className="py-2">{d.destination}</td>
                    <td className="py-2">{formatCurrency(Number(d.totalEstime ?? 0))}</td>
                    <td className="py-2"><DemandeStatusBadge statut={d.statut} /></td>
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

function DirectionDashboard({ enAttente, totalBudget, demandes }: { enAttente: number; totalBudget: number; demandes: any[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord - Direction Générale</h1>
        <p className="text-sm text-muted-foreground">Approbations finales et vue d'ensemble</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard icon={AlertCircle} label="Approbations finales en attente" value={enAttente} />
        <DashboardCard icon={TrendingUp} label="Budget total engagé" value={formatCurrency(Number(totalBudget))} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Demandes en attente d'approbation finale</CardTitle>
          <Link href="/demandes?statut=APPROUVEE_FINANCE" className="text-sm text-primary underline">
            Voir tout
          </Link>
        </CardHeader>
        <CardContent>
          {demandes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente d'approbation finale.</p>
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
                    <td className="py-2">{d.employe.prenom} {d.employe.nom}</td>
                    <td className="py-2">{d.destination}</td>
                    <td className="py-2">{formatCurrency(Number(d.totalEstime ?? 0))}</td>
                    <td className="py-2"><DemandeStatusBadge statut={d.statut} /></td>
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

function DashboardCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
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
