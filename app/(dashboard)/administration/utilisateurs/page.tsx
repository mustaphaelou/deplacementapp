"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Loader2, Pencil } from "lucide-react"
import { ROLE_LABELS } from "@/lib/roles"

interface Utilisateur {
  id: string
  email: string
  nom: string
  prenom: string
  poste: string
  role: string
  actif: boolean
  telephone: string | null
  departement: { id: string; nom: string }
}

interface Departement {
  id: string
  nom: string
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [departements, setDepartements] = useState<Departement[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<Utilisateur | null>(null)
  const [form, setForm] = useState({
    email: "",
    nom: "",
    prenom: "",
    poste: "",
    role: "EMPLOYEE",
    departementId: "",
    telephone: "",
    motDePasse: "",
  })

  async function fetchData() {
    setLoading(true)
    try {
      const [usersRes, deptRes] = await Promise.all([
        fetch("/api/utilisateurs"),
        fetch("/api/departements"),
      ])
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users)
      }
      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartements(data)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  function openEdit(user: Utilisateur) {
    setEditingUser(user)
    setForm({
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      poste: user.poste,
      role: user.role,
      departementId: user.departement.id,
      telephone: user.telephone || "",
      motDePasse: "",
    })
    setOpen(true)
  }

  function openCreate() {
    setEditingUser(null)
    setForm({ email: "", nom: "", prenom: "", poste: "", role: "EMPLOYEE", departementId: departements[0]?.id || "", telephone: "", motDePasse: "" })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingUser ? "/api/utilisateurs" : "/api/utilisateurs"
      const method = editingUser ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingUser ? { ...form, id: editingUser.id } : form),
      })
      if (!res.ok) throw new Error()
      toast.success(editingUser ? "Utilisateur modifié" : "Utilisateur créé")
      setOpen(false)
      fetchData()
    } catch {
      toast.error("Erreur")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground">{users.length} utilisateur(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Nouvel utilisateur
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun utilisateur</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Nom</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Poste</th>
                  <th className="p-3 font-medium">Département</th>
                  <th className="p-3 font-medium">Rôle</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{u.prenom} {u.nom}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.poste}</td>
                    <td className="p-3">{u.departement.nom}</td>
                    <td className="p-3">{ROLE_LABELS[u.role]}</td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Modifier" : "Nouvel"} utilisateur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Poste</Label>
                <Input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Département</Label>
                <select
                  value={form.departementId}
                  onChange={(e) => setForm({ ...form, departementId: e.target.value })}
                  className="border-input flex h-8 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
                  required
                >
                  {departements.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="border-input flex h-8 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"}</Label>
              <Input type="password" value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} required={!editingUser} minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingUser ? "Modifier" : "Créer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
