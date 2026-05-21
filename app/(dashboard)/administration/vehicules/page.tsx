"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, Search } from "lucide-react"

interface Vehicule {
  id: string
  nom: string
  immatriculation: string
  disponible: boolean
}

export default function VehiculesPage() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicule | null>(null)
  const [form, setForm] = useState({ nom: "", immatriculation: "", disponible: true })
  const [search, setSearch] = useState("")

  async function fetchVehicules() {
    setLoading(true)
    try {
      const res = await fetch("/api/vehicules")
      if (res.ok) setVehicules(await res.json())
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVehicules() }, [])

  function openEdit(v: Vehicule) {
    setEditing(v)
    setForm({ nom: v.nom, immatriculation: v.immatriculation, disponible: v.disponible })
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des véhicules</h1>
          <p className="text-sm text-muted-foreground">{vehicules.length} véhicule(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Ajouter un véhicule
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher véhicule ou immatriculation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? "Aucun résultat" : "Aucun véhicule"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="p-3 font-medium">Nom</th>
                <th className="p-3 font-medium">Immatriculation</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{v.nom}</td>
                  <td className="p-3 font-mono text-xs">{v.immatriculation}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.disponible ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                      {v.disponible ? "Disponible" : "En mission"}
                    </span>
                  </td>
                  <td className="p-3 flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier" : "Nouveau"} véhicule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Immatriculation</Label>
              <Input value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.disponible} onCheckedChange={(c) => setForm({ ...form, disponible: c as boolean })} />
              Disponible
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Modifier" : "Ajouter"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
