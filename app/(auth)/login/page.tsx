"use client"

import { useState, useEffect } from "react"
import { signInWithCredentials, signInWithGoogle } from "@/lib/auth/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { SetupWizard } from "./setup-wizard"
import { DEFAULT_SOCIETE_NOM } from "@/lib/constants"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandProvider } from "@/components/brand-provider"
import { cn } from "@/lib/utils"

const AUTH_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
const PRIMARY_BUTTON =
  "h-9 rounded-[3px] shadow-[0_1px_2px_rgba(15,15,15,0.1)] hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]"

interface Societe {
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
}

export function LoginForm({ societe }: { societe: Societe | null }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await signInWithCredentials(email, password)

    setLoading(false)

    if (result?.error) {
      toast.error("Email ou mot de passe incorrect")
      return
    }

    router.push("/")
    router.refresh()
  }

  const initial = societe?.nom?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <div className="w-[380px] max-w-full">
      <div className="flex justify-center">
        {societe?.logoUrl ? (
          <img
            src={societe.logoUrl}
            alt={societe.nom}
            className="size-12 rounded-[10px] object-contain"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-[10px] bg-primary text-xl font-bold text-primary-foreground">
            {initial}
          </div>
        )}
      </div>
      <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">
        {societe?.nom ?? DEFAULT_SOCIETE_NOM}
      </h1>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">
        Connectez-vous à votre espace de travail
      </p>

      <form className="mt-8" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" className="mb-1.5 block text-sm">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="vous@exemple.ma"
            className={AUTH_INPUT}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mt-4">
          <Label htmlFor="password" className="mb-1.5 block text-sm">
            Mot de passe
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className={AUTH_INPUT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          className={cn("mt-6 w-full", PRIMARY_BUTTON)}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continuer
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase text-muted-foreground">Ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-9 w-full rounded-[3px]"
        onClick={() => signInWithGoogle()}
      >
        <svg className="mr-2 size-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continuer avec Google
      </Button>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Application de gestion des demandes de déplacement
      </p>
    </div>
  )
}

export default function LoginPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [societe, setSociete] = useState<Societe | null>(null)

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

  if (needsSetup === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-muted/30">
        <ThemeToggle className="absolute top-4 right-4" />
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (needsSetup) {
    return <SetupWizard />
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <BrandProvider>
        <LoginForm societe={societe} />
      </BrandProvider>
    </div>
  )
}
