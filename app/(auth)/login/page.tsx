"use client"

import { useState, useEffect } from "react"
import { signInWithCredentials, signInWithGoogle } from "@/lib/auth/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Loader2,
  Eye,
  EyeOff,
  Workflow,
  ClipboardList,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { SetupWizard } from "./setup-wizard"
import { DEFAULT_SOCIETE_NOM } from "@/lib/constants"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandProvider } from "@/components/brand-provider"
import { cn } from "@/lib/utils"

const INPUT =
  "h-11 rounded-lg border-slate-300 shadow-xs placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-(--brand)/20"
const PRIMARY_BUTTON =
  "h-11 w-full rounded-lg bg-slate-900 text-sm font-medium hover:bg-slate-800"

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Workflow,
    title: "Circuit de validation clair",
    text: "Votre demande avance du brouillon à la décision : Manager, Finance, Direction — notifié à chaque étape.",
  },
  {
    icon: ClipboardList,
    title: "Saisie simple et rapide",
    text: "Transport, hébergement, repas : tout est regroupé dans une seule demande, prête en quelques minutes.",
  },
  {
    icon: FileText,
    title: "Documents et PDF automatiques",
    text: "Reçus et justificatifs attachés à la demande, avec un PDF généré pour le suivi et la facturation.",
  },
]

interface Societe {
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
}

function BrandPanel({ societe }: { societe: Societe | null }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % FEATURES.length),
      6000
    )
    return () => clearInterval(t)
  }, [])

  const nom = societe?.nom ?? DEFAULT_SOCIETE_NOM
  const initial = nom.charAt(0)?.toUpperCase() ?? "?"

  const visible = [
    FEATURES[(index - 1 + FEATURES.length) % FEATURES.length],
    FEATURES[index],
    FEATURES[(index + 1) % FEATURES.length],
  ]

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0B0F17] p-12 text-white lg:flex">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute top-1/3 -right-40 size-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 size-96 rounded-full bg-purple-600/20 blur-3xl" />
        <svg
          className="absolute inset-0 h-full w-full opacity-20"
          viewBox="0 0 800 800"
          fill="none"
        >
          <path
            d="M0 640c160-120 320 80 480-40s240-80 320 40"
            stroke="url(#login-glow)"
            strokeWidth="2"
          />
          <path
            d="M0 520c180 60 260-160 440-100s260 40 360-20"
            stroke="url(#login-glow)"
            strokeWidth="2"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="login-glow" x1="0" y1="0" x2="800" y2="800">
              <stop stopColor="#E879F9" />
              <stop offset="0.5" stopColor="#818CF8" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative flex items-center gap-3">
        {societe?.logoUrl ? (
          <img
            src={societe.logoUrl}
            alt={nom}
            className="size-9 rounded-lg object-contain"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 font-bold">
            {initial}
          </div>
        )}
        <span className="text-lg font-semibold tracking-tight">{nom}</span>
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">
          Accédez avec confiance
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Gérez vos demandes de déplacement dans un circuit clair : de la saisie
          à la décision finale, chaque étape est suivie.
        </p>

        <div
          className="relative mt-10 h-52"
          role="region"
          aria-label="Fonctionnalités clés"
        >
          {visible.map((f, i) => {
            const isActive = i === 1
            return (
              <div
                key={f.title}
                aria-hidden={!isActive}
                className={cn(
                  "absolute inset-x-0 top-0 rounded-2xl p-6 transition-all duration-500",
                  isActive
                    ? "z-10 translate-x-0 scale-100 bg-white text-slate-900 shadow-xl"
                    : "z-0 translate-x-24 bg-white/10 opacity-50",
                  i === 0 && !isActive && "-translate-x-24"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/20 text-white",
                    !isActive && "opacity-60"
                  )}
                >
                  <f.icon className="size-5" />
                </div>
                <p
                  className={cn(
                    "mt-3 font-semibold",
                    !isActive && "text-slate-200"
                  )}
                >
                  {f.title}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm leading-relaxed",
                    isActive ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  {f.text}
                </p>
              </div>
            )
          })}
        </div>

        <div
          className="mt-6 flex gap-2"
          role="tablist"
          aria-label="Fonctionnalités"
        >
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Afficher : ${f.title}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-2 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">Validation&nbsp;:</span>
        <span>Manager</span>
        <span aria-hidden="true">→</span>
        <span>Finance</span>
        <span aria-hidden="true">→</span>
        <span>Direction</span>
      </div>
    </div>
  )
}

export function LoginForm({ societe }: { societe: Societe | null }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  )

  const nom = societe?.nom ?? DEFAULT_SOCIETE_NOM
  const initial = nom.charAt(0)?.toUpperCase() ?? "?"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = "Veuillez saisir votre email."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Adresse email invalide."
    if (!password) next.password = "Veuillez saisir votre mot de passe."
    setErrors(next)
    if (next.email || next.password) return

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

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <BrandPanel societe={societe} />

      <div className="flex min-h-dvh flex-col justify-center bg-white px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <div className="flex items-center gap-2.5">
              {societe?.logoUrl ? (
                <img
                  src={societe.logoUrl}
                  alt={nom}
                  className="size-9 rounded-lg object-contain"
                />
              ) : (
                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 text-sm font-bold">
                  {initial}
                </div>
              )}
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                {nom}
              </span>
            </div>
            <div className="mt-8 h-px bg-slate-100" />
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">
            Bienvenue
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Connectez-vous à votre espace de travail
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="vous@exemple.ma"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={cn(INPUT, errors.email && "border-red-400")}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password" className="text-sm">
                  Mot de passe
                </Label>
                <a
                  href="#"
                  className="text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-slate-600"
                >
                  Mot de passe oublié&nbsp;?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Entrez votre mot de passe"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className={cn(
                    INPUT,
                    "pr-11",
                    errors.password && "border-red-400"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4.5" />
                  ) : (
                    <Eye className="size-4.5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">
                  {errors.password}
                </p>
              )}
            </div>

            <Button type="submit" className={PRIMARY_BUTTON} disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Se connecter
            </Button>
          </form>

          <div className="my-8 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-500">Ou continuer avec</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg border-slate-200 bg-white text-sm font-medium hover:bg-slate-50"
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

          <p className="mt-8 text-center text-sm text-slate-500">
            Pas encore de compte&nbsp;?{" "}
            <span className="font-semibold text-slate-900">
              Contactez votre administrateur
            </span>
          </p>

          <p className="mt-10 text-center text-xs text-slate-400">
            © 2026 {nom} — Application de gestion des demandes de déplacement
          </p>
        </div>
      </div>
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
    <div className="relative min-h-dvh">
      <ThemeToggle className="absolute top-4 right-4 z-20" />
      <BrandProvider>
        <LoginForm societe={societe} />
      </BrandProvider>
    </div>
  )
}
