"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, X, Save, Camera, Mail, Phone, Briefcase, Building2, Calendar, Clock, Eye, EyeOff } from "lucide-react"
import { formatDate } from "@/lib/constants"

interface UserData {
  id: string
  email: string
  nom: string
  prenom: string
  poste: string
  telephone: string | null
  avatarUrl: string | null
  role: string
  departement: { nom: string }
  dateEmbauche: Date | null
  creeLe: Date
  _count: { demandes: number }
}

function getInitials(prenom: string, nom: string) {
  return `${prenom[0]}${nom[0]}`.toUpperCase()
}

export default function ProfileEdit({ user }: { user: UserData }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [telephone, setTelephone] = useState(user.telephone ?? "")
  const [poste, setPoste] = useState(user.poste)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<string | null>(null)

  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const avatarSrc = avatarPreview || user.avatarUrl

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WebP")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
      setAvatarFile(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveAvatar() {
    setAvatarPreview(null)
    setAvatarFile("")
  }

  function cancelEdit() {
    setEditing(false)
    setTelephone(user.telephone ?? "")
    setPoste(user.poste)
    setEmail(user.email)
    setCurrentPassword("")
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { telephone, poste }
      let needsRelogin = false

      if (email !== user.email) {
        if (!currentPassword) {
          toast.error("Mot de passe requis pour modifier l'email")
          setSaving(false)
          return
        }
        body.email = email
        body.currentPassword = currentPassword
        needsRelogin = true
      }

      if (avatarFile === "") {
        body.avatarData = null
      } else if (avatarFile) {
        body.avatarData = avatarFile
      }

      const res = await fetch("/api/utilisateurs/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur")
        return
      }

      toast.success("Profil mis à jour")
      setEditing(false)
      setCurrentPassword("")

      if (needsRelogin) {
        toast.success("Email modifié — veuillez vous reconnecter")
        await signOut({ redirectTo: "/login" })
      } else {
        router.refresh()
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Tous les champs sont requis")
      return
    }
    if (pwNew.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères")
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("/api/utilisateurs/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur")
        return
      }

      toast.success("Mot de passe modifié — veuillez vous reconnecter")
      await signOut({ redirectTo: "/login" })
    } catch {
      toast.error("Erreur")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 p-8 text-primary-foreground">
        <div className="absolute right-0 top-0 size-64 translate-x-1/4 -translate-y-1/4 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-1/3 size-48 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-6">
          <div className="relative group">
            <Avatar className="size-20 ring-4 ring-white/30">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} alt={`${user.prenom} ${user.nom}`} />
              ) : null}
              <AvatarFallback className="bg-white/20 text-3xl font-bold text-primary-foreground">
                {getInitials(user.prenom, user.nom)}
              </AvatarFallback>
            </Avatar>
            {editing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-full items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100 cursor-pointer"
                >
                  <Camera className="size-6 text-white" />
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold">
              {user.prenom} {user.nom}
            </h1>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                  className="h-7 w-64 border-white/30 bg-white/10 text-primary-foreground placeholder:text-white/50 text-sm"
                  placeholder="Poste"
                />
              </div>
            ) : (
              <p className="text-white/80">{user.poste}</p>
            )}
            <Badge
              variant="secondary"
              className="bg-white/20 text-primary-foreground hover:bg-white/30"
            >
              {user.departement.nom}
            </Badge>
          </div>
          <div>
            {editing ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-white hover:bg-white/20">
                  <X className="size-4" />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-white text-primary hover:bg-white/90">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-white hover:bg-white/20">
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
        </div>
        {editing && avatarFile === "" && user.avatarUrl && (
          <div className="relative mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRemoveAvatar}
              className="text-white/70 hover:text-white hover:bg-white/20 text-xs"
            >
              Supprimer la photo
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Briefcase className="text-primary size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.demandes}</p>
              <p className="text-xs text-muted-foreground">Demandes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Calendar className="text-primary size-5" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {user.dateEmbauche ? formatDate(user.dateEmbauche) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Date d&apos;embauche</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Clock className="text-primary size-5" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatDate(user.creeLe)}</p>
              <p className="text-xs text-muted-foreground">Membre depuis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personal info */}
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {email !== user.email && (
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Mot de passe actuel (requis pour modifier l&apos;email)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-poste">Poste</Label>
                <Input
                  id="edit-poste"
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  <Building2 className="mr-1 inline size-4" />
                  {user.departement.nom}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-8 items-center justify-center rounded-lg">
                  <Mail className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-8 items-center justify-center rounded-lg">
                  <Phone className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p className="text-sm font-medium">{user.telephone ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-8 items-center justify-center rounded-lg">
                  <Briefcase className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Poste</p>
                  <p className="text-sm font-medium">{user.poste}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-8 items-center justify-center rounded-lg">
                  <Building2 className="text-muted-foreground size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Département</p>
                  <p className="text-sm font-medium">{user.departement.nom}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); handleChangePassword() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="pw-current">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="pw-current"
                  type={showPwCurrent ? "text" : "password"}
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwCurrent(!showPwCurrent)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="pw-new"
                  type={showPwNew ? "text" : "password"}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwNew(!showPwNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="pw-confirm"
                  type={showPwConfirm ? "text" : "password"}
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
