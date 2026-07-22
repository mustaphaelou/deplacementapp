"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

export function SetupWizard({ initialDepartements }: { initialDepartements: string[] }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [departements, setDepartements] = useState<string[]>(initialDepartements)
  const [newDepartement, setNewDepartement] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [nom, setNom] = useState("")
  const [prenom, setPrenom] = useState("")
  const [poste, setPoste] = useState("")
  const [departementNom, setDepartementNom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function addDepartement(e: React.FormEvent) {
    e.preventDefault()
    const name = newDepartement.trim()
    if (!name) return
    if (!departements.includes(name)) {
      setDepartements([...departements, name])
    }
    setNewDepartement("")
  }

  function removeDepartement(name: string) {
    setDepartements(departements.filter((d) => d !== name))
    if (departementNom === name) setDepartementNom(null)
  }

  function goToStep2() {
    if (!departementNom && departements.length > 0) {
      setDepartementNom(departements[0])
    }
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    if (!departementNom || !departements.includes(departementNom)) {
      toast.error("Sélectionnez un département")
      return
    }

    setLoading(true)

    const res = await fetch("/api/setup/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departements,
        admin: { email, password, nom, prenom, poste, departementNom },
      }),
    })

    if (!res.ok) {
      setLoading(false)
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Erreur lors de la configuration")
      return
    }

    const result = await signIn("credentials", { email, password, redirect: false })

    if (result?.error) {
      setLoading(false)
      toast.error("Compte créé — veuillez vous connecter")
      window.location.assign("/login")
      return
    }

    toast.success("Configuration terminée — bienvenue !")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <div className="bg-primary flex size-12 items-center justify-center rounded-xl text-primary-foreground text-lg font-bold">
              H
            </div>
          </div>
          <CardTitle>Configuration initiale</CardTitle>
          <CardDescription>
            {step === 1
              ? "Départements de l'organisation (1/2)"
              : "Compte administrateur (2/2)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              {departements.length > 0 ? (
                <ul className="space-y-2">
                  {departements.map((dep) => (
                    <li
                      key={dep}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>{dep}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeDepartement(dep)}
                        aria-label={`Retirer ${dep}`}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun département pour le moment — ajoutez-en au moins un.
                </p>
              )}
              <form onSubmit={addDepartement} className="flex gap-2">
                <Input
                  placeholder="Nom du département"
                  value={newDepartement}
                  onChange={(e) => setNewDepartement(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  <Plus />
                  Ajouter
                </Button>
              </form>
              <Button
                type="button"
                className="w-full"
                disabled={departements.length === 0}
                onClick={goToStep2}
              >
                Continuer
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input
                    id="prenom"
                    placeholder="Sara"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    placeholder="Alaoui"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  placeholder="vous@hay2010.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="poste">Poste</Label>
                <Input
                  id="poste"
                  placeholder="Directeur Général"
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                  required
                />
              </div>
              <Select
                label="Département"
                value={departementNom}
                onValueChange={setDepartementNom}
              >
                {departements.map((dep) => (
                  <SelectItem key={dep} value={dep}>
                    {dep}
                  </SelectItem>
                ))}
              </Select>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Mot de passe</Label>
                <Input
                  id="setup-password"
                  type="password"
                  placeholder="8 caractères minimum"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Retour
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Terminer la configuration
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
