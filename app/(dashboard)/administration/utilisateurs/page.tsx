"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
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
import { Plus, Loader2, Pencil, Search, Users } from "lucide-react"
import { ROLE_LABELS } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { buildUtilisateurPayload } from "./submit-payload"

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

export function UtilisateursTable({
  users,
  onEdit,
}: {
  users: Utilisateur[]
  onEdit: (user: Utilisateur) => void
}) {
  return (
    <div className={tableShellClass}>
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Nom complet
            </th>
            {/* #307: the eight cells this table hides below a breakpoint ask
                the shared rule for their half of the pair instead of writing
                `hidden … :table-cell` into the header. The page keeps the
                base cell geometry, which is its own decision. */}
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "md" })
              )}
            >
              Email
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "md" })
              )}
            >
              Poste
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "lg" })
              )}
            >
              Département
            </th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Rôle
            </th>
            <th className="px-2 py-2 font-normal text-muted-foreground">
              Statut
            </th>
            <th
              className={cn(
                "px-2 py-2 font-normal text-muted-foreground",
                hideClassFor({ hideAt: "lg" })
              )}
            >
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
                rowHoverInkTint
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
              <td
                className={cn(
                  "px-2 py-2.5 text-xs",
                  hideClassFor({ hideAt: "md" })
                )}
              >
                {u.email}
              </td>
              <td
                className={cn("px-2 py-2.5", hideClassFor({ hideAt: "md" }))}
              >
                {u.poste}
              </td>
              <td
                className={cn("px-2 py-2.5", hideClassFor({ hideAt: "lg" }))}
              >
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
              <td
                className={cn("px-2 py-2.5", hideClassFor({ hideAt: "lg" }))}
              >
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
          buildUtilisateurPayload(form, editingUser?.id ?? null)
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
      {/* #261: the header geometry and the breadcrumb markup live in the
          shared module; the page passes only what varies. */}
      <PageHeader
        crumbs={["Administration", "Utilisateurs"]}
        title="Utilisateurs"
        subtitle={<>{users.length} utilisateur(s)</>}
        icon={Users}
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Nouvel utilisateur
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
                  className={textInputClass}
                />
              </Field>
              <Field label="Nom">
                <Input
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  required
                  className={textInputClass}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className={textInputClass}
              />
            </Field>
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field label="Poste">
                <Input
                  value={form.poste}
                  onChange={(e) => setForm({ ...form, poste: e.target.value })}
                  required
                  className={textInputClass}
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
                className={textInputClass}
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
                className={textInputClass}
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
