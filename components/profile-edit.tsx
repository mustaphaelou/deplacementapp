"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DashboardCard } from "@/components/ui/dashboard-card"
import {
  Loader2,
  Pencil,
  X,
  Save,
  Camera,
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react"
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

const FIELD_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"

function getInitials(prenom: string, nom: string) {
  return `${prenom[0]}${nom[0]}`.toUpperCase()
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Property({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{children}</p>
    </div>
  )
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
    <div className="mx-auto w-full max-w-[720px] pb-8">
      {/* Flat header row */}
      <div className="flex items-center gap-4">
        <div className="group relative shrink-0">
          <Avatar className="size-16">
            {avatarSrc ? (
              <AvatarImage
                src={avatarSrc}
                alt={`${user.prenom} ${user.nom}`}
              />
            ) : null}
            <AvatarFallback className="text-xl font-bold">
              {getInitials(user.prenom, user.nom)}
            </AvatarFallback>
          </Avatar>
          {profile.editing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-full cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100"
              >
                <Camera className="size-5 text-white" />
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
        <div className="min-w-0 flex-1">
          <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
            {user.prenom} {user.nom}
          </h1>
          {profile.editing ? (
            <Input
              value={profile.poste}
              onChange={(e) => profile.setPoste(e.target.value)}
              className={`mt-2 w-64 ${FIELD_INPUT}`}
              placeholder="Poste"
            />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{user.poste}</p>
          )}
          <Badge variant="secondary" className="mt-2">
            {user.departement.nom}
          </Badge>
        </div>
        <div className="shrink-0">
          {profile.editing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={profile.cancelEdit}
                aria-label="Annuler"
              >
                <X className="size-4" />
              </Button>
              <Button
                size="sm"
                onClick={profile.handleSave}
                disabled={profile.saving}
              >
                {profile.saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => profile.setEditing(true)}
              aria-label="Modifier le profil"
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {profile.editing && profile.avatarFile === "" && user.avatarUrl && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="xs"
            onClick={profile.handleRemoveAvatar}
            className="text-xs text-muted-foreground"
          >
            Supprimer la photo
          </Button>
        </div>
      )}

      {/* Stats — borderless row */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <DashboardCard
          icon={Briefcase}
          label="Demandes"
          value={user._count.demandes}
        />
        <DashboardCard
          icon={Calendar}
          label="Date d'embauche"
          value={user.dateEmbauche ? formatDate(user.dateEmbauche) : "—"}
        />
        <DashboardCard
          icon={Clock}
          label="Membre depuis"
          value={formatDate(user.creeLe)}
        />
      </div>

      {/* Informations personnelles */}
      <section className="mt-10">
        <SectionHeading>Informations personnelles</SectionHeading>
        <div className="mt-5">
          {profile.editing ? (
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-email" className="mb-1.5 block text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  className={FIELD_INPUT}
                  value={profile.email}
                  onChange={(e) => profile.setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone" className="mb-1.5 block text-sm font-medium">
                  Téléphone
                </Label>
                <Input
                  id="edit-phone"
                  className={FIELD_INPUT}
                  value={profile.telephone}
                  onChange={(e) => profile.setTelephone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-poste" className="mb-1.5 block text-sm font-medium">
                  Poste
                </Label>
                <Input
                  id="edit-poste"
                  className={FIELD_INPUT}
                  value={profile.poste}
                  onChange={(e) => profile.setPoste(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm font-medium">
                  Département
                </Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  <Building2 className="mr-1 size-4" />
                  {user.departement.nom}
                </p>
              </div>
              {profile.email !== user.email && (
                <div className="sm:col-span-2">
                  <Label
                    htmlFor="edit-password"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Mot de passe actuel (requis pour modifier l&apos;email)
                  </Label>
                  <Input
                    id="edit-password"
                    type="password"
                    className={FIELD_INPUT}
                    value={profile.currentPassword}
                    onChange={(e) =>
                      profile.setCurrentPassword(e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Property label="Email">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {user.email}
                </span>
              </Property>
              <Property label="Téléphone">{user.telephone ?? "—"}</Property>
              <Property label="Poste">{user.poste}</Property>
              <Property label="Département">{user.departement.nom}</Property>
            </div>
          )}
        </div>
      </section>

      {/* Sécurité */}
      <section className="mt-10">
        <SectionHeading>Sécurité</SectionHeading>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pw.handleChangePassword()
          }}
          className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2"
        >
          <div>
            <Label htmlFor="pw-current" className="mb-1.5 block text-sm font-medium">
              Mot de passe actuel
            </Label>
            <div className="relative">
              <Input
                id="pw-current"
                type={pw.showPwCurrent ? "text" : "password"}
                className={FIELD_INPUT}
                value={pw.pwCurrent}
                onChange={(e) => pw.setPwCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwCurrent(!pw.showPwCurrent)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {pw.showPwCurrent ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="pw-new" className="mb-1.5 block text-sm font-medium">
              Nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="pw-new"
                type={pw.showPwNew ? "text" : "password"}
                className={FIELD_INPUT}
                value={pw.pwNew}
                onChange={(e) => pw.setPwNew(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwNew(!pw.showPwNew)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {pw.showPwNew ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="pw-confirm" className="mb-1.5 block text-sm font-medium">
              Confirmer le nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="pw-confirm"
                type={pw.showPwConfirm ? "text" : "password"}
                className={FIELD_INPUT}
                value={pw.pwConfirm}
                onChange={(e) => pw.setPwConfirm(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwConfirm(!pw.showPwConfirm)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {pw.showPwConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="h-9 rounded-[3px]"
              disabled={pw.savingPassword}
            >
              {pw.savingPassword && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
