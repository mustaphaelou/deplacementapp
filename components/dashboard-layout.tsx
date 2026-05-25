import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { StatPill } from "@/components/ui/stat-pill"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { formatCurrency, formatDate } from "@/lib/constants"
import type { NavItem } from "@/lib/roles"
import type { DashboardConfig, TableColumnId } from "@/lib/dashboard-config"
import type { DashboardDemandeSummary } from "@/lib/dashboard"

interface DashboardLayoutProps {
  config: DashboardConfig
  navItems: NavItem[]
  demandes: DashboardDemandeSummary[]
}

const cellRenderers: Record<TableColumnId, (d: DashboardDemandeSummary) => React.ReactNode> = {
  numero: (d) => (
    <Link href={`/demandes/${d.id}`} className="text-primary hover:underline font-medium">
      {d.numero}
    </Link>
  ),
  employe: (d) => (
    <span className="text-muted-foreground">{d.employe ? `${d.employe.prenom} ${d.employe.nom}` : "N/A"}</span>
  ),
  destination: (d) => <>{d.destination}</>,
  dates: (d) => (
    <span className="text-muted-foreground text-xs">
      {formatDate(d.dateDepart)} – {formatDate(d.dateRetour)}
    </span>
  ),
  date: (d) => (
    <span className="text-muted-foreground text-xs">{formatDate(d.dateDepart)}</span>
  ),
  total: (d) => <>{formatCurrency(Number(d.totalEstime ?? 0))}</>,
  statut: (d) => <DemandeStatusBadge statut={d.statut} />,
}

export function DashboardLayout({ config, navItems, demandes }: DashboardLayoutProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">{config.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {config.statPills.map((pill, i) => (
          <StatPill key={i} {...pill} />
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accès rapide
        </h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navItems.filter((i) => i.href !== "/").map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline mt-auto">
                  Accéder →
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {config.table.title}
          </h2>
          <Link href={config.table.viewAllHref} className="text-xs text-primary hover:underline">
            Voir toutes
          </Link>
        </div>
        {demandes.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{config.table.emptyMessage}</p>
            {config.cta && (
              <Link href={config.cta.href} className="mt-2 inline-block text-sm text-primary hover:underline">
                + Créer une nouvelle demande
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm min-w-[300px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  {config.table.columns.map((col) => {
                    const hideClass = col.hideAt ? `hidden ${col.hideAt === "sm" ? "sm:table-cell" : col.hideAt === "md" ? "md:table-cell" : "lg:table-cell"}` : ""
                    return (
                      <th key={col.id} className={`px-4 py-2.5 font-medium ${hideClass}`}>
                        {col.label}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    {config.table.columns.map((col) => {
                      const hideClass = col.hideAt ? `hidden ${col.hideAt === "sm" ? "sm:table-cell" : col.hideAt === "md" ? "md:table-cell" : "lg:table-cell"}` : ""
                      return (
                        <td key={col.id} className={`px-4 py-2.5 ${hideClass}`}>
                          {cellRenderers[col.id](d)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {config.cta && demandes.length > 0 && (
        <Link
          href={config.cta.href}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition"
        >
          {(() => { const Icon = config.cta!.icon; return <Icon className="size-4" /> })()}
          {config.cta.label}
        </Link>
      )}
    </div>
  )
}
