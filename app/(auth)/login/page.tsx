"use client"

import { useState, useEffect } from "react"
import { signInWithCredentials, signInWithGoogle } from "@/lib/auth/client"
import { googleRefusalMessage } from "@/lib/auth/google-refusals"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { SetupWizard } from "./setup-wizard"
import { DEFAULT_SOCIETE_NOM } from "@/lib/constants"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandProvider } from "@/components/brand-provider"
import { cn } from "@/lib/utils"

/**
 * Cloudflare sign-in geometry (#245): 36px controls, 1px hairline borders, 5px
 * radius, 13px text.  The focus ring takes the Societe's `couleurPrimaire`
 * through `--brand` (IdentiteVisuelle) — the accent is never hardcoded here.
 */
const INPUT =
  "h-9 rounded-[5px] border-border bg-background text-[13px] shadow-none placeholder:text-muted-foreground focus-visible:border-(--brand) focus-visible:ring-2 focus-visible:ring-(--brand)/20 dark:bg-background"

/** Near-black in light, near-white in dark — the Cloudflare primary. */
const PRIMARY_BUTTON =
  "h-9 w-full rounded-[5px] bg-slate-900 text-[13px] font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"

interface Societe {
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
}

interface CredentialErrors {
  email?: string
  password?: string
}

/**
 * The decided French validation messages, as a pure function of the two raw
 * field values so the node-environment render suite can drive them without a
 * DOM.  Both fields are reported at once when both are empty.
 */
export function validateCredentials(
  email: string,
  password: string
): CredentialErrors {
  const next: CredentialErrors = {}
  if (!email.trim()) next.email = "Veuillez saisir votre email."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    next.email = "Adresse email invalide."
  if (!password) next.password = "Veuillez saisir votre mot de passe."
  return next
}

/**
 * The message of a refused Google sign-in, read from a URL search string
 * (with or without the leading "?").  `null` when the page was not reached
 * through a refusal — the surface then renders no alert at all.  Pure so the
 * node-environment render suite can drive it without a DOM.
 */
export function googleRefusalFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  if (!params.has("error")) return null
  return googleRefusalMessage(params.get("error"))
}

/**
 * Remove the refusal parameters (`error`, `error_description`) from an href so
 * a refresh shows a clean page — the "no zombie parameter" rule.  Every other
 * parameter and the hash are preserved; the result is a relative URL
 * (`pathname + search + hash`, the shape `history.replaceState` accepts) and
 * the input is returned unchanged when it carries no refusal parameter.
 */
export function stripRefusalParams(href: string): string {
  const url = new URL(href, "http://localhost")
  const carriesRefusal =
    url.searchParams.has("error") || url.searchParams.has("error_description")
  if (!carriesRefusal) return href
  url.searchParams.delete("error")
  url.searchParams.delete("error_description")
  return `${url.pathname}${url.search}${url.hash}`
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
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
  )
}

export function LoginForm({
  societe,
  connexionGoogle,
  refusalMessage,
}: {
  societe: Societe | null
  connexionGoogle: boolean
  refusalMessage?: string | null
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<CredentialErrors>({})

  const nom = societe?.nom ?? DEFAULT_SOCIETE_NOM
  const initial = nom.charAt(0)?.toUpperCase() ?? "?"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateCredentials(email, password)
    setErrors(next)
    if (next.email || next.password) return

    setLoading(true)
    // `rememberMe` asks the engine for a long-lived session cookie; it is a
    // documented field of the sign-in request body.
    const result = await signInWithCredentials(email, password, rememberMe)
    setLoading(false)

    if (result?.error) {
      toast.error("Email ou mot de passe incorrect")
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-5 py-10">
      <div className="w-full max-w-[348px]">
        <div className="flex items-center justify-center gap-2.5">
          {societe?.logoUrl ? (
            <img
              src={societe.logoUrl}
              alt={nom}
              className="size-[30px] rounded-[7px] object-contain"
            />
          ) : (
            // IdentiteVisuelle: the fallback mark takes the Societe's primary
            // colour through the --brand custom property (BrandProvider), with
            // the theme primary as fallback when no couleurPrimaire is set.
            <div className="flex size-[30px] items-center justify-center rounded-[7px] bg-(--brand) text-[15px] font-semibold text-white">
              {initial}
            </div>
          )}
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            {nom}
          </span>
        </div>

        <h1 className="mt-7 text-center text-[21px] font-semibold tracking-[-0.02em]">
          Connectez-vous à votre espace
        </h1>
        <p className="mt-1.5 text-center text-[13px] text-muted-foreground">
          Gestion des demandes de déplacement
        </p>

        {refusalMessage && (
          <div
            role="alert"
            className="mt-6 rounded-[5px] border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] leading-relaxed text-destructive"
          >
            {refusalMessage}
          </div>
        )}

        <form className="mt-7" onSubmit={handleSubmit} noValidate>
          {connexionGoogle && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-[5px] bg-background text-[13px] font-medium"
                onClick={() => signInWithGoogle()}
              >
                <GoogleMark />
                Continuer avec Google
              </Button>

              <div
                className="my-5 flex items-center gap-3"
                role="separator"
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                  ou
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email" className="mb-1.5 block text-[13px]">
              Adresse e-mail
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
              className={cn(INPUT, errors.email && "border-destructive")}
            />
            {errors.email && (
              <p
                id="email-error"
                className="mt-1.5 text-[12px] text-destructive"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="mt-4">
            <Label htmlFor="password" className="mb-1.5 block text-[13px]">
              Mot de passe
            </Label>
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
                  "pr-10",
                  errors.password && "border-destructive"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition hover:text-foreground"
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                className="mt-1.5 text-[12px] text-destructive"
              >
                {errors.password}
              </p>
            )}

            <div className="mt-2.5 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-3.5 rounded-[3px] border-border accent-(--brand)"
                />
                Se souvenir de moi
              </label>
              <a
                href="#"
                className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Mot de passe oublié&nbsp;?
              </a>
            </div>
          </div>

          <Button type="submit" className={PRIMARY_BUTTON} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Pas encore de compte&nbsp;?{" "}
          <span className="font-medium text-foreground">
            Contactez votre administrateur
          </span>
        </p>

        <p className="mt-7 border-t border-border pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          © 2026 {nom} — Application de gestion des demandes de déplacement
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [societe, setSociete] = useState<Societe | null>(null)
  const [connexionGoogle, setConnexionGoogle] = useState(false)
  // A refusal arrives in the URL (`?error=…&error_description=…`): read its
  // message once, while the URL still carries it — the strip effect below
  // removes the parameters right after mount.  `typeof window` keeps the
  // server prerender (which only ever shows the loader) clean.
  const [refusalMessage] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : googleRefusalFromSearch(window.location.search)
  )

  useEffect(() => {
    // Strip the refusal parameters so a refresh shows a clean page — the "no
    // zombie parameter" rule.  `replaceState` updates the URL in place and
    // never navigates, so it cannot re-render the page into a loop.
    const cleaned = stripRefusalParams(window.location.href)
    if (cleaned !== window.location.href) {
      window.history.replaceState(null, "", cleaned)
    }
  }, [])

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        setNeedsSetup(Boolean(data.needsSetup))
        setConnexionGoogle(Boolean(data.connexionGoogle))
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
        <LoginForm
          societe={societe}
          connexionGoogle={connexionGoogle}
          refusalMessage={refusalMessage}
        />
      </BrandProvider>
    </div>
  )
}
