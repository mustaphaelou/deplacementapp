"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/page-header"
import { StatusPill } from "@/components/status-pill"
import {
  Field,
  hideClassFor,
  LoadingBlock,
  rowHoverInkTint,
  searchFieldIconClass,
  searchFieldInputClass,
  tableShellClass,
  textInputClass,
} from "@/components/display"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, Search, Car } from "lucide-react"
import type { Vehicule } from "@/lib/demande-types"
import { cn } from "@/lib/utils"

export function VehiculesTable({
  vehicules,
  onEdit,
  onDelete,
}: {
  vehicules: Vehicule[]
  onEdit: (vehicule: Vehicule) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={tableShellClass}>
      <table className="w-full min-w-[300px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-normal text-muted-foreground">Nom</th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Immatriculation
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "sm" })
              )}
            >
              Statut
            </th>
            <th className="w-8 px-2 py-2 text-right font-normal text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {vehicules.map((v) => (
            <tr
              key={v.id}
              className={cn(
                "group border-b border-border transition-colors last:border-0",
                rowHoverInkTint
              )}
            >
              <td className="px-2 py-2.5 font-medium">{v.nom}</td>
              <td className="px-2 py-2.5 font-mono text-xs">
                {v.immatriculation}
              </td>
              <td className={cn("px-2 py-2.5", hideClassFor({ hideAt: "sm" }))}>
                <StatusPill
                  label={v.disponible ? "Disponible" : "En mission"}
                  tone={v.disponible ? "success" : "pending"}
                />
              </td>
              <td className="w-8 px-2 py-2.5 text-right">
                <div className="flex justify-end gap-1 opacity-30 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(v)}
                    aria-label={`Modifier ${v.nom}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(v.id)}
                    aria-label={`Supprimer ${v.nom}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicule | null>(null)
  const [form, setForm] = useState({
    nom: "",
    immatriculation: "",
    disponible: true,
  })
  const [search, setSearch] = useState("")

  async function fetchVehicules() {
    setLoading(true)
    try {
      const res = await fetch("/api/vehicules")
      if (res.ok) setVehicules(await res.json())
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await fetchVehicules()
    })()
  }, [])

  function openEdit(v: Vehicule) {
    setEditing(v)
    setForm({
      nom: v.nom,
      immatriculation: v.immatriculation,
      disponible: v.disponible,
    })
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setForm({ nom: "", immatriculation: "", disponible: true })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const method = editing ? "PUT" : "POST"
      const res = await fetch("/api/vehicules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      })
      if (!res.ok) throw new Error()
      toast.success(editing ? "Véhicule modifié" : "Véhicule ajouté")
      setOpen(false)
      fetchVehicules()
    } catch {
      toast.error("Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce véhicule ?")) return
    try {
      const res = await fetch("/api/vehicules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success("Véhicule supprimé")
      fetchVehicules()
    } catch {
      toast.error("Erreur")
    }
  }

  const filtered = vehicules.filter(
    (v) =>
      v.nom.toLowerCase().includes(search.toLowerCase()) ||
      v.immatriculation.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* #261: the header geometry and the breadcrumb markup live in the
          shared module; the page passes only what varies. */}
      <PageHeader
        crumbs={["Administration", "Véhicules"]}
        title="Véhicules"
        subtitle={<>{vehicules.length} véhicule(s)</>}
        icon={Car}
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Ajouter un véhicule
          </Button>
        }
      />

      <div className="flex justify-end">
        <div className="relative">
          <Search className={searchFieldIconClass} />
          <Input
            placeholder="Rechercher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={searchFieldInputClass}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8">
          <Car className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {search ? "Aucun résultat" : "Aucun véhicule"}
          </p>
        </div>
      ) : (
        <VehiculesTable
          vehicules={filtered}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier" : "Nouveau"} véhicule
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Nom">
              <Input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                required
                className={textInputClass}
              />
            </Field>
            <Field label="Immatriculation">
              <Input
                value={form.immatriculation}
                onChange={(e) =>
                  setForm({ ...form, immatriculation: e.target.value })
                }
                required
                className={textInputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.disponible}
                onCheckedChange={(c) =>
                  setForm({ ...form, disponible: c as boolean })
                }
              />
              Disponible
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-[3px]"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="h-9 rounded-[3px]"
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editing ? "Modifier" : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
