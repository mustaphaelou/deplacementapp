import { FileText, FilePlus, Bell, BarChart3, Plus, ClipboardList, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/constants"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { EmployeeDashboardData } from "@/lib/dashboard"
import { NAV_ITEMS } from "@/lib/roles"

interface EmployeeDashboardProps {
  data: EmployeeDashboardData
}

const iconL: Record<string, React.ElementType> = {
  "dashboard-square-01": BarChart3,
  "notification-01": Bell,
  "file-01": FileText,
  "file-plus": FilePlus,
}

const desc: Record<string, string> = {
  "Tableau de bord": "Vue d'ensemble et statistiques",
  "Notifications": "Alertes et mises à jour",
  "Mes Demandes": "Historique de vos demandes",
  "Nouvelle Demande": "Créer une demande de déplacement",
}

export function EmployeeDashboard({ data }: EmployeeDashboardProps) {
  const { stats, demandes } = data
  const navItems = [...NAV_ITEMS.common, ...NAV_ITEMS.EMPLOYEE]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Bienvenue sur votre espace personnel</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatPill icon={FileText} label="Total" value={stats.total} color="blue" />
        <StatPill icon={Clock} label="Brouillons" value={stats.brouillon} color="amber" />
        <StatPill icon={AlertCircle} label="Soumises" value={stats.soumises} color="orange" />
        <StatPill icon={CheckCircle} label="Approuvées" value={stats.approuvees} color="green" />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accès rapide
        </h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navItems.filter(i => i.href !== "/").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {(() => { const I = iconL[item.icon] ?? FileText; return <I className="size-5" /> })()}
              </div>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {desc[item.label] ?? "Accéder à la page"}
                </p>
              </div>
              <span className="text-xs text-primary font-medium group-hover:underline mt-auto">
                Accéder →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mes dernières demandes
          </h2>
          <Link href="/demandes" className="text-xs text-primary hover:underline">
            Voir toutes
          </Link>
        </div>
        {demandes.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
            <Link href="/demandes/nouvelle" className="mt-2 inline-block text-sm text-primary hover:underline">
              + Créer une nouvelle demande
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm min-w-[300px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Destination</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">Dates</th>
                  <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Total</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/demandes/${d.id}`} className="text-primary hover:underline font-medium">
                        {d.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">{d.destination}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                      {formatDate(d.dateDepart)} – {formatDate(d.dateRetour)}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      {formatCurrency(Number(d.totalEstime ?? 0))}
                    </td>
                    <td className="px-4 py-2.5">
                      <DemandeStatusBadge statut={d.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link
        href="/demandes/nouvelle"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition"
      >
        <Plus className="size-4" />
        Nouvelle demande de déplacement
      </Link>
    </div>
  )
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  color: "blue" | "green" | "amber" | "orange" | "purple"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  }
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${colors[color]}`}>
      <Icon className="size-3.5" />
      <span className="opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
