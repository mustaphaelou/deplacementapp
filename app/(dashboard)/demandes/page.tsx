"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuthUser } from "@/lib/auth/client"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { StatusPill, statusOf } from "@/components/status-pill"
import { formatCurrency, formatDate } from "@/lib/constants"
import { queueEtapes } from "@/lib/workflow"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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

const rowHover =
  "hover:bg-[rgba(55,53,47,0.024)] dark:hover:bg-sidebar-accent/40"

export function DemandesTable({
  demandes,
  role,
}: {
  demandes: Demande[]
  role?: string
}) {
  const router = useRouter()

  return (
    <div className="overflow-x-auto border-y border-border text-sm">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-normal text-muted-foreground">
              N°
            </th>
            {role !== "EMPLOYEE" && (
              <th className="hidden px-2 py-2 font-normal text-muted-foreground sm:table-cell">
                Employé
              </th>
            )}
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Destination
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground md:table-cell">
              Dates
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground lg:table-cell">
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
            const status = statusOf(d)
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
                  rowHover
                )}
              >
                <td className="px-2 py-2.5 font-medium">{d.numero}</td>
                {role !== "EMPLOYEE" && (
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    {d.employe.prenom} {d.employe.nom}
                  </td>
                )}
                <td className="px-2 py-2.5">{d.destination}</td>
                <td className="hidden px-2 py-2.5 md:table-cell">
                  {formatDate(d.dateDepart)} → {formatDate(d.dateRetour)}
                </td>
                <td className="hidden px-2 py-2.5 lg:table-cell">
                  {formatCurrency(Number(d.totalEstime ?? 0))}
                </td>
                <td className="px-2 py-2.5">
                  <StatusPill label={status.label} tone={status.tone} />
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
                  href: `/demandes?etape=${queueEtape}`,
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
  }, [page, search, etapeFilter])

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

  const canExportCsv =
    role === "FINANCE_ADMIN" || role === "GENERAL_DIRECTION"

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Espace</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span>Demandes de déplacement</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
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
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} demande(s)
            </p>
          </div>
        </div>
      </div>

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
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
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
