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
  ChevronRight,
  Building,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/ui/dashboard-card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { StatusPill } from "@/components/status-pill"
import { toDemandePresentation } from "@/lib/demande-presentation"
import { formatCurrency, formatDate } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/auth"
import type {
  DashboardConfig,
  TableColumnId,
  DashboardDemandeSummary,
} from "@/lib/dashboard"

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
  building: Building,
}

// The ink tint the rest of the shell hovers with — the home page rows read as
// the same surface as the sidebar and the list page, not as shadcn's muted.
const rowHover =
  "hover:bg-[rgba(55,53,47,0.024)] dark:hover:bg-sidebar-accent/40"
const rowActionHover =
  "hover:bg-[rgba(55,53,47,0.06)] dark:hover:bg-sidebar-accent/50"

interface DashboardLayoutProps {
  config: DashboardConfig
  navItems: NavItem[]
  demandes: DashboardDemandeSummary[]
}

function hideClassFor(col: { hideAt?: "sm" | "md" | "lg" }) {
  if (!col.hideAt) return undefined
  const showAt =
    col.hideAt === "sm"
      ? "sm:table-cell"
      : col.hideAt === "md"
        ? "md:table-cell"
        : "lg:table-cell"
  return `hidden ${showAt}`
}

const cellRenderers: Record<
  TableColumnId,
  (d: DashboardDemandeSummary) => React.ReactNode
> = {
  numero: (d) => <span className="font-medium">{d.numero}</span>,
  employe: (d) =>
    d.employe ? (
      <span>{`${d.employe.prenom} ${d.employe.nom}`}</span>
    ) : (
      <span className="text-muted-foreground">N/A</span>
    ),
  destination: (d) => <>{d.destination}</>,
  dates: (d) => (
    <span className="text-muted-foreground">
      {formatDate(d.dateDepart)} → {formatDate(d.dateRetour)}
    </span>
  ),
  date: (d) => (
    <span className="text-muted-foreground">{formatDate(d.dateDepart)}</span>
  ),
  total: (d) => (
    <span className="tabular-nums">
      {formatCurrency(Number(d.totalEstime ?? 0))}
    </span>
  ),
  etape: (d) => {
    const presentation = toDemandePresentation(d)
    return (
      <StatusPill label={presentation.compactLabel} tone={presentation.tone} />
    )
  },
}

export function DashboardLayout({
  config,
  navItems,
  demandes,
}: DashboardLayoutProps) {
  const CtaIcon = config.cta ? iconMap[config.cta.icon] || FilePlus : null
  const quickLinks = navItems.filter((i) => i.href !== "/")

  return (
    <div className="space-y-6">
      {/* Page header — the geometry every sibling page already uses: breadcrumb
          row with the primary action top-right, then the icon tile + title. */}
      <div>
        <div className="flex items-center justify-between gap-4">
          {/* #254: the breadcrumb is the one header element that can run out of
              room, so it truncates to a single line instead of wrapping. It
              needs three things together, none of which the shadcn primitive
              gives us: min-w-0 on the nav and on the last item (a flex item's
              default min-width:auto refuses to shrink below its content),
              flex-nowrap to stop the list breaking across lines, and truncate
              on the page itself to ellipsise. twMerge drops the primitive's
              flex-wrap when it sees flex-nowrap, so this is a real override. */}
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem>
                <span>Espace</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="min-w-0 truncate font-medium">
                  Tableau de bord
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {config.cta && CtaIcon && (
            <Button
              render={<Link href={config.cta.href} />}
              nativeButton={false}
              className="shrink-0"
            >
              <CtaIcon data-icon="inline-start" />
              {config.cta.label}
            </Button>
          )}
        </div>
        <div className="mt-6 flex items-center gap-4">
          {/* #254: 40px tile on a phone, 48px from md: up. The tile shrinks as
              the title shrinks, so the header never grows on a small screen. */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12">
            <BarChart3 className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">
              Tableau de bord
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.statPills.map((pill, i) => {
          const Icon = iconMap[pill.icon] || FileText
          return (
            <DashboardCard
              key={i}
              icon={Icon}
              label={pill.label}
              value={pill.value}
            />
          )
        })}
      </div>

      <section>
        <h2 className="text-base font-semibold tracking-tight">Accès rapide</h2>
        {/* One hairline panel. Each cell draws its own rule with an inset
            outline, so the dividers collapse to a single 1px line and a grid
            that does not fill its last row leaves no phantom cell — a shared
            container background painting through a 1px gap would. */}
        <div className="mt-3 grid gap-px overflow-hidden rounded-[3px] border border-border sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = iconMap[item.icon] || FileText
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex min-w-0 items-center gap-2.5 bg-background px-3 py-2.5 outline-none shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  rowActionHover
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">
            {config.table.title}
          </h2>
          <Link
            href={config.table.viewAllHref}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Voir toutes
          </Link>
        </div>
        {demandes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border-y border-border py-12 text-center">
            <ClipboardList className="size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">{config.table.title}</p>
            <p className="text-sm text-muted-foreground">
              {config.table.emptyMessage}
            </p>
            {config.cta && CtaIcon && (
              <Link
                href={config.cta.href}
                className="mt-1 text-sm text-primary underline-offset-4 hover:underline"
              >
                {config.cta.label}
              </Link>
            )}
          </div>
        ) : (
          /* The database table the list page uses — hairline rules top and
             bottom, no left/right borders, ink-tint row hover. */
          <div className="overflow-x-auto border-y border-border text-sm">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left">
                  {config.table.columns.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        "px-2 py-2 font-normal text-muted-foreground",
                        hideClassFor(col)
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr
                    key={d.id}
                    className={cn(
                      "group border-b border-border transition-colors last:border-0",
                      rowHover
                    )}
                  >
                    {config.table.columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn("px-2 py-2.5", hideClassFor(col))}
                      >
                        {cellRenderers[col.id](d)}
                      </td>
                    ))}
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/demandes/${d.id}`}
                        aria-label={`Ouvrir la demande ${d.numero}`}
                        className="flex items-center justify-end text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className="size-3.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
