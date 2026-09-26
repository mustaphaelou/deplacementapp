import { Fragment } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/**
 * A crumb is text, not markup. A plain string renders as a plain item; the
 * `{ label, href }` form renders the same item as a link back up the trail.
 * Callers never pass nodes: the breadcrumb is the fragile half of this block,
 * and accepting pre-built nodes would push its markup back out to every
 * caller — the exact duplication this module removes.
 */
export type PageCrumb = string | { label: string; href: string }

/**
 * The page header, owned once.
 *
 * #254 landed this geometry on the home page and #258 copied it to seven more
 * pages; nine call sites were each carrying the same six class strings. They
 * live here now, so the next responsive change is one edit instead of nine.
 *
 * The breadcrumb trail is built here rather than passed in, because its
 * truncation is a three-part dependency that nothing hands you for free:
 * `flex-nowrap` on the list (twMerge drops the primitive's `flex-wrap` for it),
 * `min-w-0` on the nav and on the last item (a flex item's default
 * `min-width: auto` refuses to shrink below its content), and `truncate` on the
 * page element itself, which is what draws the ellipsis. Lose one of the three
 * and the header silently grows a second line.
 *
 * The module ends at the header. Whatever a page renders below it — a search
 * field, a stat grid, a table, a form — stays the page's own markup.
 *
 * Desktop geometry from `md:` up is locked and stays byte-identical: 40px
 * title, 48px tile, 3px radius. `md:` is the single shell breakpoint, so no
 * other size variant belongs here.
 */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  crumbs: PageCrumb[]
  title: string
  /** A node, not a string: a page may put a live count in this position. */
  subtitle?: React.ReactNode
  /** Absent renders no tile — an explicit absence, never a forked block. */
  icon?: LucideIcon
  /** A slot, not a set of named variants: each page keeps its own action. */
  action?: React.ReactNode
}) {
  return (
    <div>
      {/* gap-4 is a minimum separation between the trail and the action, so it
          only binds when the row is full. Two of the ten call sites carried it
          and eight did not; keeping it here is the form that holds in the
          tight case those two were defending. */}
      <div className="flex items-center justify-between gap-4">
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1
              const label = typeof crumb === "string" ? crumb : crumb.label

              return (
                <Fragment key={`${label}-${index}`}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {isLast ? (
                    // min-w-0 on the item + truncate on the page, or the
                    // ellipsis can never engage.
                    <BreadcrumbItem className="min-w-0">
                      <BreadcrumbPage className="min-w-0 truncate font-medium">
                        {label}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : typeof crumb === "string" ? (
                    <BreadcrumbItem>
                      <span>{label}</span>
                    </BreadcrumbItem>
                  ) : (
                    <BreadcrumbItem>
                      <Link
                        href={crumb.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {label}
                      </Link>
                    </BreadcrumbItem>
                  )}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        {action}
      </div>
      <div className="mt-6 flex items-center gap-4">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12">
            <Icon className="size-6 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}
