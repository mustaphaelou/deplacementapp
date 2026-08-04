"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { Loader2, Settings } from "lucide-react"

interface Societe {
  id: string
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
  nomExpediteurEmail: string | null
  domaineEmail: string | null
}

const FIELD_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {children}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const validHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"

  return (
    <div className="flex gap-2">
      <Input
        id="couleurPrimaire"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#0F766E"
        className={FIELD_INPUT}
      />
      <button
        type="button"
        aria-label="Choisir une couleur"
        onClick={() => pickerRef.current?.click()}
        className="size-9 shrink-0 rounded-[3px] border border-input bg-transparent transition-[box-shadow] outline-none focus-visible:ring-1 focus-visible:ring-(--brand)"
        style={{ backgroundColor: value }}
      >
        <input
          ref={pickerRef}
          type="color"
          value={validHex}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </button>
    </div>
  )
}

export function SocieteSettings({
  societe,
  nom,
  couleurPrimaire,
  nomExpediteurEmail,
  domaineEmail,
  saving,
  onNomChange,
  onCouleurPrimaireChange,
  onNomExpediteurEmailChange,
  onDomaineEmailChange,
  onSave,
}: {
  societe: Societe | null
  nom: string
  couleurPrimaire: string
  nomExpediteurEmail: string
  domaineEmail: string
  saving: boolean
  onNomChange: (value: string) => void
  onCouleurPrimaireChange: (value: string) => void
  onNomExpediteurEmailChange: (value: string) => void
  onDomaineEmailChange: (value: string) => void
  onSave: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSave} className="mt-10 space-y-10">
      <section>
        <SectionHeading>Identité visuelle</SectionHeading>
        <div className="mt-5 space-y-5">
          <Field label="Nom de la société" htmlFor="nom">
            <Input
              id="nom"
              value={nom}
              onChange={(e) => onNomChange(e.target.value)}
              required
              className={FIELD_INPUT}
            />
          </Field>
          <Field label="Couleur primaire" htmlFor="couleurPrimaire">
            <ColorField
              value={couleurPrimaire}
              onChange={onCouleurPrimaireChange}
            />
          </Field>
          {societe?.logoUrl && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Logo actuel
              </p>
              <img
                src={societe.logoUrl}
                alt="Logo"
                className="max-h-20 rounded-[3px] object-contain"
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading>Email</SectionHeading>
        <div className="mt-5 space-y-5">
          <Field
            label="Nom d'expéditeur email"
            htmlFor="nomExpediteur"
            hint='Apparaît comme expéditeur des emails (ex: "Ma Société")'
          >
            <Input
              id="nomExpediteur"
              value={nomExpediteurEmail}
              onChange={(e) => onNomExpediteurEmailChange(e.target.value)}
              placeholder="Ma Société"
              className={FIELD_INPUT}
            />
          </Field>
          <Field
            label="Domaine email"
            htmlFor="domaineEmail"
            hint="Utilisé pour l'adresse d'envoi: noreply@domaine.ma"
          >
            <Input
              id="domaineEmail"
              value={domaineEmail}
              onChange={(e) => onDomaineEmailChange(e.target.value)}
              placeholder="masociete.ma"
              className={FIELD_INPUT}
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="h-9 rounded-[3px]" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

export default function SocietePage() {
  const [societe, setSociete] = useState<Societe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nom, setNom] = useState("")
  const [couleurPrimaire, setCouleurPrimaire] = useState("")
  const [nomExpediteurEmail, setNomExpediteurEmail] = useState("")
  const [domaineEmail, setDomaineEmail] = useState("")

  useEffect(() => {
    fetch("/api/societe")
      .then((r) => r.json())
      .then((data) => {
        setSociete(data)
        setNom(data.nom ?? "")
        setCouleurPrimaire(data.couleurPrimaire ?? "")
        setNomExpediteurEmail(data.nomExpediteurEmail ?? "")
        setDomaineEmail(data.domaineEmail ?? "")
      })
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch("/api/societe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom,
        couleurPrimaire: couleurPrimaire || null,
        nomExpediteurEmail: nomExpediteurEmail || null,
        domaineEmail: domaineEmail || null,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      toast.error("Erreur lors de la sauvegarde")
      return
    }

    const updated = await res.json()
    setSociete(updated)
    toast.success("Paramètres mis à jour")
  }

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8">
      <div>
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Administration</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Société</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <Settings className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              Société
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Personnalisez le nom, la couleur et les emails de votre instance
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SocieteSettings
          societe={societe}
          nom={nom}
          couleurPrimaire={couleurPrimaire}
          nomExpediteurEmail={nomExpediteurEmail}
          domaineEmail={domaineEmail}
          saving={saving}
          onNomChange={setNom}
          onCouleurPrimaireChange={setCouleurPrimaire}
          onNomExpediteurEmailChange={setNomExpediteurEmail}
          onDomaineEmailChange={setDomaineEmail}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
