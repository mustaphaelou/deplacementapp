"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

interface Societe {
  id: string
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
  nomExpediteurEmail: string | null
  domaineEmail: string | null
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de la société</h1>
        <p className="text-sm text-muted-foreground">
          Personnalisez le nom, le logo et les couleurs de votre instance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identité visuelle</CardTitle>
          <CardDescription>
            Ces informations apparaissent dans l&apos;en-tête, les emails et les PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom de la société</Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="couleur">Couleur primaire</Label>
              <div className="flex gap-2">
                <Input
                  id="couleur"
                  value={couleurPrimaire}
                  onChange={(e) => setCouleurPrimaire(e.target.value)}
                  placeholder="#1E40AF"
                />
                {couleurPrimaire && (
                  <div
                    className="size-10 shrink-0 rounded-md border"
                    style={{ backgroundColor: couleurPrimaire }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomExpediteur">Nom d&apos;expéditeur email</Label>
              <Input
                id="nomExpediteur"
                value={nomExpediteurEmail}
                onChange={(e) => setNomExpediteurEmail(e.target.value)}
                placeholder="Ma Société"
              />
              <p className="text-xs text-muted-foreground">
                Apparaît comme expéditeur des emails (ex: &quot;Ma Société&quot;)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domaineEmail">Domaine email</Label>
              <Input
                id="domaineEmail"
                value={domaineEmail}
                onChange={(e) => setDomaineEmail(e.target.value)}
                placeholder="masociete.ma"
              />
              <p className="text-xs text-muted-foreground">
                Utilisé pour l&apos;adresse d&apos;envoi: noreply@domaine.ma
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Save className="mr-2 size-4" />
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      {societe?.logoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Logo actuel</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={societe.logoUrl}
              alt="Logo"
              className="max-h-20 rounded-lg object-contain"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}