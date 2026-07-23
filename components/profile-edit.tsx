"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, X, Save, Camera, Mail, Phone, Briefcase, Building2, Calendar, Clock, Eye, EyeOff } from "lucide-react"
import { formatDate } from "@/lib/constants"
import { useProfileForm } from "@/hooks/use-profile-form"
import { usePasswordChange } from "@/hooks/use-password-change"

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
  const fileRef = useRef<HTMLInputElement>(null)
  const profile = useProfileForm({
    email: user.email,
    telephone: user.telephone,
    poste: user.poste,
    avatarUrl: user.avatarUrl,
  })

  const pw = usePasswordChange()

  const avatarSrc = profile.avatarSrc

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
            {profile.editing && (
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
              onChange={profile.handleAvatarSelect}
            />
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold">
              {user.prenom} {user.nom}
            </h1>
            {profile.editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={profile.poste}
                  onChange={(e) => profile.setPoste(e.target.value)}
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
            {profile.editing ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={profile.cancelEdit} className="text-white hover:bg-white/20">
                  <X className="size-4" />
                </Button>
                <Button size="sm" onClick={profile.handleSave} disabled={profile.saving} className="bg-white text-primary hover:bg-white/90">
                  {profile.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => profile.setEditing(true)} className="text-white hover:bg-white/20">
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
        </div>
        {profile.editing && profile.avatarFile === "" && user.avatarUrl && (
          <div className="relative mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="xs"
              onClick={profile.handleRemoveAvatar}
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
          {profile.editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => profile.setEmail(e.target.value)}
                />
              </div>
              {profile.email !== user.email && (
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Mot de passe actuel (requis pour modifier l&apos;email)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={profile.currentPassword}
                    onChange={(e) => profile.setCurrentPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={profile.telephone}
                  onChange={(e) => profile.setTelephone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-poste">Poste</Label>
                <Input
                  id="edit-poste"
                  value={profile.poste}
                  onChange={(e) => profile.setPoste(e.target.value)}
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
            <div className="grid gap-4 sm:gap-2 sm:grid-cols-2">
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
            onSubmit={(e) => { e.preventDefault(); pw.handleChangePassword() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="pw-current">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="pw-current"
                  type={pw.showPwCurrent ? "text" : "password"}
                  value={pw.pwCurrent}
                  onChange={(e) => pw.setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => pw.setShowPwCurrent(!pw.showPwCurrent)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {pw.showPwCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="pw-new"
                  type={pw.showPwNew ? "text" : "password"}
                  value={pw.pwNew}
                  onChange={(e) => pw.setPwNew(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => pw.setShowPwNew(!pw.showPwNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {pw.showPwNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="pw-confirm"
                  type={pw.showPwConfirm ? "text" : "password"}
                  value={pw.pwConfirm}
                  onChange={(e) => pw.setPwConfirm(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => pw.setShowPwConfirm(!pw.showPwConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {pw.showPwConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={pw.savingPassword}>
              {pw.savingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
