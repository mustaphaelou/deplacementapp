"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DemandeStatusBadge } from "@/components/demande-status-badge"
import { formatCurrency, formatDate, STATUT_LABELS, ITEMS_PER_PAGE } from "@/lib/constants"
import { Search, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react"
import { toast } from "sonner"

interface Demande {
  id: string
  numero: string
  destination: string
  dateDepart: string
  dateRetour: string
  totalEstime: number
  statut: string
  employe: { prenom: string; nom: string }
  employeId: string
}

export default function DemandesListPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const statutFilter = searchParams.get("statut") || ""
  const perPage = 10
  const role = (session?.user as any)?.role

  async function fetchDemandes() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("limit", perPage.toString())
    if (statutFilter) params.set("statut", statutFilter)
    if (search) params.set("recherche", search)

    try {
      const res = await fetch(`/api/demandes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDemandes(data.demandes)
        setTotal(data.total)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDemandes()
  }, [page, statutFilter, search])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {statutFilter
              ? `${STATUT_LABELS[statutFilter] ?? "Demandes"}`
              : role === "EMPLOYEE"
              ? "Mes demandes"
              : "Demandes"}
          </h1>
          <p className="text-sm text-muted-foreground">{total} demande(s)</p>
        </div>
        <div className="flex gap-2">
          {(role === "FINANCE_ADMIN" || role === "GENERAL_DIRECTION") && (
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="mr-2 size-4" />
              CSV
            </Button>
          )}
          {role === "EMPLOYEE" && (
            <Link href="/demandes/nouvelle">
              <Button>
                <FileText className="mr-2 size-4" />
                Nouvelle demande
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Rechercher par destination, numéro..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : demandes.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Aucune demande trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">N°</th>
                  {role !== "EMPLOYEE" && <th className="p-3 font-medium hidden sm:table-cell">Employé</th>}
                  <th className="p-3 font-medium">Destination</th>
                  <th className="p-3 font-medium hidden md:table-cell">Dates</th>
                  <th className="p-3 font-medium hidden lg:table-cell">Total</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{d.numero}</td>
                    {role !== "EMPLOYEE" && (
                      <td className="p-3 hidden sm:table-cell">{d.employe.prenom} {d.employe.nom}</td>
                    )}
                    <td className="p-3">{d.destination}</td>
                    <td className="p-3 hidden md:table-cell">{formatDate(d.dateDepart)}</td>
                    <td className="p-3 hidden lg:table-cell">{formatCurrency(Number(d.totalEstime ?? 0))}</td>
                    <td className="p-3"><DemandeStatusBadge statut={d.statut} /></td>
                    <td className="p-3">
                      <Link href={`/demandes/${d.id}`}>
                        <Button variant="ghost" size="xs">Voir</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
