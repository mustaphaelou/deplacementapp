"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { SetupWizard } from "./setup-wizard"

interface Societe {
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
}

export default function LoginPage() {
  const router = useRouter()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [societe, setSociete] = useState<Societe | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        setNeedsSetup(Boolean(data.needsSetup))
        if (!data.needsSetup) {
          fetch("/api/societe")
            .then((r) => r.json())
            .then((s) => setSociete(s))
            .catch(() => {})
        }
      })
      .catch(() => setNeedsSetup(true))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      toast.error("Email ou mot de passe incorrect")
      return
    }

    router.push("/")
    router.refresh()
  }

  if (needsSetup === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (needsSetup) {
    return <SetupWizard />
  }

  const initial = societe?.nom?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            {societe?.logoUrl ? (
              <img
                src={societe.logoUrl}
                alt={societe.nom}
                className="size-12 rounded-xl object-contain"
              />
            ) : (
              <div className="bg-primary flex size-12 items-center justify-center rounded-xl text-primary-foreground text-lg font-bold">
                {initial}
              </div>
            )}
          </div>
          <CardTitle>{societe?.nom ?? "Application"}</CardTitle>
          <CardDescription>Connexion à votre espace de travail</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.ma"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Se connecter
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Application de gestion des demandes de déplacement
          </p>
        </CardContent>
      </Card>
    </div>
  )
}