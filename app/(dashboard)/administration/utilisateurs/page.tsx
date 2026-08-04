"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectItem } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { StatusPill } from "@/components/status-pill"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Search, Users } from "lucide-react"
import { ROLE_LABELS } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface Utilisateur {
  id: string
  email: string
  nom: string
  prenom: string
  poste: string
  role: string
  actif: boolean
  telephone: string | null
  googleAuthEnabled: boolean
  departement: { id: string; nom: string }
}

interface Departement {
  id: string
  nom: string
}

const FIELD_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
const rowHover =
  "hover:bg-[rgba(55,53,47,0.024)] dark:hover:bg-sidebar-accent/40"

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

export function UtilisateursTable({
  users,
  onEdit,
}: {
  users: Utilisateur[]
  onEdit: (user: Utilisateur) => void
}) {
  return (
    <div className="overflow-x-auto border-y border-border text-sm">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Nom complet
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground md:table-cell">
              Email
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground md:table-cell">
              Poste
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground lg:table-cell">
              Département
            </th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Rôle
            </th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Statut
            </th>
            <th className="hidden px-2 py-2 font-normal text-muted-foreground lg:table-cell">
              Auth
            </th>
            <th className="w-8 px-2 py-2 text-right font-normal text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className={cn(
                "group border-b border-border transition-colors last:border-0",
                rowHover
              )}
            >
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {u.prenom[0]}
                    {u.nom[0]}
                  </div>
                  <span className="font-medium">
                    {u.prenom} {u.nom}
                  </span>
                </div>
              </td>
              <td className="hidden px-2 py-2.5 text-xs md:table-cell">
                {u.email}
              </td>
              <td className="hidden px-2 py-2.5 md:table-cell">{u.poste}</td>
              <td className="hidden px-2 py-2.5 lg:table-cell">
                {u.departement.nom}
              </td>
              <td className="px-2 py-2.5">
                <StatusPill
                  label={ROLE_LABELS[u.role] ?? u.role}
                  tone="neutral"
                />
              </td>
              <td className="px-2 py-2.5">
                <StatusPill
                  label={u.actif ? "Actif" : "Inactif"}
                  tone={u.actif ? "success" : "danger"}
                />
              </td>
              <td className="hidden px-2 py-2.5 lg:table-cell">
                {u.googleAuthEnabled && (
                  <StatusPill label="Google" tone="neutral" />
                )}
              </td>
              <td className="w-8 px-2 py-2.5 text-right">
                <div className="flex justify-end opacity-30 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(u)}
                    aria-label={`Modifier ${u.prenom} ${u.nom}`}
                  >
                    <Pencil />
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
    googleAuthEnabled: false,
  })
  const [search, setSearch] = useState("")

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
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
  }, [])

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
      googleAuthEnabled: user.googleAuthEnabled,
    })
    setOpen(true)
  }

  function openCreate() {
    setEditingUser(null)
    setForm({
      email: "",
      nom: "",
      prenom: "",
      poste: "",
      role: "EMPLOYEE",
      departementId: departements[0]?.id || "",
      telephone: "",
      motDePasse: "",
      googleAuthEnabled: false,
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const method = editingUser ? "PUT" : "POST"
      const res = await fetch("/api/utilisateurs", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingUser ? { ...form, id: editingUser.id } : form
        ),
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

  const filtered = users.filter(
    (u) =>
      u.nom.toLowerCase().includes(search.toLowerCase()) ||
      u.prenom.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.departement.nom.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Administration</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  Utilisateurs
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Nouvel utilisateur
          </Button>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <Users className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              Utilisateurs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {users.length} utilisateur(s)
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-60 pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8">
          <Users className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {search ? "Aucun résultat" : "Aucun utilisateur"}
          </p>
        </div>
      ) : (
        <UtilisateursTable users={filtered} onEdit={openEdit} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Modifier" : "Nouvel"} utilisateur
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field label="Prénom">
                <Input
                  value={form.prenom}
                  onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                  required
                  className={FIELD_INPUT}
                />
              </Field>
              <Field label="Nom">
                <Input
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  required
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className={FIELD_INPUT}
              />
            </Field>
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field label="Poste">
                <Input
                  value={form.poste}
                  onChange={(e) => setForm({ ...form, poste: e.target.value })}
                  required
                  className={FIELD_INPUT}
                />
              </Field>
              <Select
                label="Département"
                value={form.departementId}
                onValueChange={(v) =>
                  setForm({ ...form, departementId: v ?? "" })
                }
              >
                {departements.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nom}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Select
              label="Rôle"
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v ?? "EMPLOYEE" })}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </Select>
            <Field label="Téléphone">
              <Input
                value={form.telephone}
                onChange={(e) =>
                  setForm({ ...form, telephone: e.target.value })
                }
                className={FIELD_INPUT}
              />
            </Field>
            <Field
              label={
                editingUser
                  ? "Nouveau mot de passe (laisser vide pour conserver)"
                  : "Mot de passe"
              }
            >
              <Input
                type="password"
                value={form.motDePasse}
                onChange={(e) =>
                  setForm({ ...form, motDePasse: e.target.value })
                }
                required={!editingUser && !form.googleAuthEnabled}
                minLength={6}
                className={FIELD_INPUT}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.googleAuthEnabled}
                onChange={(e) =>
                  setForm({ ...form, googleAuthEnabled: e.target.checked })
                }
                className="size-4 rounded border-border accent-primary"
              />
              Connexion Google autorisée
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
                {editingUser ? "Modifier" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
