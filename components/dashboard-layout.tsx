import Link from "next/link"
import {
  ClipboardList,
  BarChart3,
  FileText,
  FilePlus,
  Users,
  Clock,
  DollarSign,
  Car,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCard } from "@/components/ui/dashboard-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { formatCurrency, formatDate } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/roles"
import type { DashboardConfig, TableColumnId, DashboardDemandeSummary } from "@/lib/dashboard"

const iconMap: Record<string, LucideIcon> = {
  "bar-chart-3": BarChart3,
  "file-text": FileText,
  "file-plus": FilePlus,
  users: Users,
  clock: Clock,
  "dollar-sign": DollarSign,
  car: Car,
  "check-circle": CheckCircle,
  "alert-circle": AlertCircle,
  plus: Plus,
}

interface DashboardLayoutProps {
  config: DashboardConfig
  navItems: NavItem[]
  demandes: DashboardDemandeSummary[]
}

function hideClassFor(col: { hideAt?: "sm" | "md" | "lg" }) {
  if (!col.hideAt) return undefined
  const showAt = col.hideAt === "sm" ? "sm:table-cell" : col.hideAt === "md" ? "md:table-cell" : "lg:table-cell"
  return `hidden ${showAt}`
}

const cellRenderers: Record<TableColumnId, (d: DashboardDemandeSummary) => React.ReactNode> = {
  numero: (d) => (
    <Link href={`/demandes/${d.id}`} className="font-medium text-primary hover:underline">
      {d.numero}
    </Link>
  ),
  employe: (d) =>
    d.employe ? (
      <div className="flex items-center gap-2.5">
        <Avatar className="size-7">
          <AvatarFallback className="text-[10px]">
            {`${d.employe.prenom[0] ?? ""}${d.employe.nom[0] ?? ""}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{`${d.employe.prenom} ${d.employe.nom}`}</span>
      </div>
    ) : (
      <span className="text-muted-foreground">N/A</span>
    ),
  destination: (d) => <>{d.destination}</>,
  dates: (d) => (
    <span className="text-xs text-muted-foreground">
      {formatDate(d.dateDepart)} – {formatDate(d.dateRetour)}
    </span>
  ),
  date: (d) => <span className="text-xs text-muted-foreground">{formatDate(d.dateDepart)}</span>,
  total: (d) => <span className="tabular-nums">{formatCurrency(Number(d.totalEstime ?? 0))}</span>,
  statut: (d) => <DemandeStatusBadge statut={d.statut} />,
}

export function DashboardLayout({ config, navItems, demandes }: DashboardLayoutProps) {
  const CtaIcon = config.cta ? iconMap[config.cta.icon] || FilePlus : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        {config.cta && CtaIcon && (
          <Button render={<Link href={config.cta.href} />} nativeButton={false}>
            <CtaIcon data-icon="inline-start" />
            {config.cta.label}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.statPills.map((pill, i) => {
          const Icon = iconMap[pill.icon] || FileText
          return <DashboardCard key={i} icon={Icon} label={pill.label} value={pill.value} />
        })}
      </div>

      <section>
        <h2 className="mb-4 text-base font-semibold tracking-tight">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {navItems
            .filter((i) => i.href !== "/")
            .map((item) => {
              const Icon = iconMap[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:size-5">
                      <Icon />
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div className="mt-auto">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </Link>
              )
            })}
        </div>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{config.table.title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={config.table.viewAllHref} />}
            nativeButton={false}
          >
            Voir toutes
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {demandes.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>{config.table.title}</EmptyTitle>
                <EmptyDescription>{config.table.emptyMessage}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {config.table.columns.map((col) => (
                    <TableHead key={col.id} className={hideClassFor(col)}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {demandes.map((d) => (
                  <TableRow key={d.id}>
                    {config.table.columns.map((col) => (
                      <TableCell key={col.id} className={cn(hideClassFor(col), "py-3")}>
                        {cellRenderers[col.id](d)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
