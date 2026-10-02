"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthUser } from "@/lib/auth/client"
import { hasAnyRole, ROLES_MANAGEMENT } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/status-pill"
import { formatCurrency, formatDate } from "@/lib/constants"
import { toDemandePresentation } from "@/lib/demande-presentation"
import { queueEtapes } from "@/lib/workflow"
import { PageHeader } from "@/components/page-header"
import {
  hideClassFor,
  LoadingBlock,
  rowHoverInkTint,
  searchFieldIconClass,
  tableShellClass,
} from "@/components/display"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
} from "lucide-react"
import { toast } from "sonner"

interface Demande {
  id: string
  numero: string
  destination: string
  dateDepart: string
  dateRetour: string
  totalEstime: number
  etape: string
  decision: string
  employe: { prenom: string; nom: string }
  employeId: string
}

export function DemandesTable({
  demandes,
  role,
}: {
  demandes: Demande[]
  role?: string
}) {
  const router = useRouter()

  return (
    <div className={tableShellClass}>
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-normal text-muted-foreground">
              N°
            </th>
            {role !== "EMPLOYEE" && (
              <th
                className={cn(
                  "px-2 py-2 font-normal text-muted-foreground",
                  hideClassFor({ hideAt: "sm" })
                )}
              >
                Employé
              </th>
            )}
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Destination
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "md" })
              )}
            >
              Dates
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "lg" })
              )}
            >
              Total
            </th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Statut
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {demandes.map((d) => {
            const presentation = toDemandePresentation(d)
            return (
              <tr
                key={d.id}
                onClick={() => router.push(`/demandes/${d.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/demandes/${d.id}`)
                }}
                role="link"
                tabIndex={0}
                className={cn(
                  "group cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  rowHoverInkTint
                )}
              >
                <td className="px-2 py-2.5 font-medium">{d.numero}</td>
                {role !== "EMPLOYEE" && (
                  <td
                    className={cn(
                      "px-2 py-2.5",
                      hideClassFor({ hideAt: "sm" })
                    )}
                  >
                    {d.employe.prenom} {d.employe.nom}
                  </td>
                )}
                <td className="px-2 py-2.5">{d.destination}</td>
                <td
                  className={cn(
                    "px-2 py-2.5",
                    hideClassFor({ hideAt: "md" })
                  )}
                >
                  {formatDate(d.dateDepart)} → {formatDate(d.dateRetour)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2.5",
                    hideClassFor({ hideAt: "lg" })
                  )}
                >
                  {formatCurrency(Number(d.totalEstime ?? 0))}
                </td>
                <td className="px-2 py-2.5">
                  <StatusPill
                    label={presentation.compactLabel}
                    tone={presentation.tone}
                  />
                </td>
                <td className="px-2 py-2.5">
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function DemandesListPage() {
  const { user } = useAuthUser()
  const searchParams = useSearchParams()
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const etapeFilter = searchParams.get("etape") || ""
  const decisionFilter = searchParams.get("decision") || ""
  const perPage = 10
  const role = user?.role

  const title = role === "EMPLOYEE" ? "Mes demandes" : "Demandes"
  const queueEtape = role
    ? queueEtapes(role as Parameters<typeof queueEtapes>[0])[0]
    : undefined
  const tabs =
    role === "EMPLOYEE"
      ? [
          { label: "Toutes", href: "/demandes", match: "" },
          { label: "Brouillons", href: "/demandes?etape=DRAFT", match: "DRAFT" },
          { label: "Finalisées", href: "/demandes?etape=FINAL", match: "FINAL" },
        ]
      : [
          { label: "Toutes", href: "/demandes", match: "" },
          ...(queueEtape
            ? [
                {
                  label: "En attente",
                  href: `/demandes?etape=${queueEtape}&decision=PENDING`,
                  match: queueEtape,
                },
              ]
            : []),
          { label: "Finalisées", href: "/demandes?etape=FINAL", match: "FINAL" },
        ]

  const fetchDemandes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("limit", perPage.toString())
    if (etapeFilter) params.set("etape", etapeFilter)
    if (decisionFilter) params.set("decision", decisionFilter)
    if (search) params.set("recherche", search)

    try {
      const res = await fetch(`/api/demandes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDemandes(data.demandes)
        setTotal(data.total)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, search, etapeFilter, decisionFilter])

  useEffect(() => {
    ;(async () => {
      await fetchDemandes()
    })()
  }, [fetchDemandes])

  const totalPages = Math.ceil(total / perPage)

  async function handleExportCsv() {
    try {
      const res = await fetch("/api/csv")
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "demandes.csv"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("CSV exporté")
    } catch {
      toast.error("Erreur d'export")
    }
  }

  // #286: this page used to decide the export question with its own inline
  // Role comparison — the one site of the eight that reached around the guard
  // interface, and therefore the one that could drift from /api/csv's own guard
  // with nothing to catch it. It now asks the same question through the same
  // interface, with the same declared set. The comparison is deleted, not
  // wrapped: a local helper would be the re-derivation this ticket removes.
  const canExportCsv = role ? hasAnyRole(role, ROLES_MANAGEMENT) : false

  return (
    <div className="space-y-6">
      {/* #261: the header geometry and the breadcrumb markup live in the
          shared module; the page passes only what varies. The trail is three
          deep here and two on the administration pages — a longer array, not a
          variant of the module. */}
      <PageHeader
        crumbs={["Espace", "Demandes de déplacement", title]}
        title={title}
        subtitle={<>{total} demande(s)</>}
        icon={FileText}
        action={
          <div className="flex items-center gap-2">
            {canExportCsv && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" onClick={handleExportCsv}>
                      <Download className="size-4" />
                      CSV
                    </Button>
                  }
                />
                <TooltipContent>Exporter en CSV</TooltipContent>
              </Tooltip>
            )}
            {role === "EMPLOYEE" && (
              <Link href="/demandes/nouvelle">
                <Button>
                  <FileText className="size-4" />
                  Nouvelle demande
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = etapeFilter === tab.match
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  "h-8 rounded-[3px] px-3 text-sm transition-colors",
                  active
                    ? "bg-[#F1F1EF] font-medium dark:bg-sidebar-accent"
                    : "hover:bg-[rgba(55,53,47,0.06)] dark:hover:bg-sidebar-accent/50"
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
        <div className="relative">
          <Search className={searchFieldIconClass} />
          <Input
            className="w-60 pl-8"
            placeholder="Rechercher"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : demandes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8">
          <FileText className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Aucune demande trouvée.
          </p>
        </div>
      ) : (
        <DemandesTable demandes={demandes} role={role} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
