"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react"
import { usePasswordChange } from "@/hooks/use-password-change"

/**
 * Forced-rotation gate (#238).  Rendered by the dashboard layout instead of
 * the app shell while `doitChangerMotDePasse` is set — the holder still
 * authenticates with an administrator-issued temporary credential.  It reuses
 * the self-service password-change hook, so rotation flows through the same
 * endpoint (which clears the flag) and ends with a reconnect on the new
 * credential.  Pure except for the hook's fetch/toast/signOut side effects.
 */
export default function RotationGate({ email }: { email: string }) {
  const pw = usePasswordChange()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-[560px] rounded-lg border bg-card p-8 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <KeyRound className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Créez votre mot de passe
            </h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Votre compte utilise encore le mot de passe temporaire remis par
          votre administrateur. Choisissez votre propre mot de passe pour
          accéder à l&apos;application.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            pw.handleChangePassword()
          }}
          className="mt-6 grid gap-x-4 gap-y-5"
        >
          <div>
            <Label
              htmlFor="rotation-current"
              className="mb-1.5 block text-sm font-medium"
            >
              Mot de passe temporaire
            </Label>
            <div className="relative">
              <Input
                id="rotation-current"
                type={pw.showPwCurrent ? "text" : "password"}
                className="h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
                value={pw.pwCurrent}
                onChange={(e) => pw.setPwCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwCurrent(!pw.showPwCurrent)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  pw.showPwCurrent
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
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
            <Label
              htmlFor="rotation-new"
              className="mb-1.5 block text-sm font-medium"
            >
              Nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="rotation-new"
                type={pw.showPwNew ? "text" : "password"}
                className="h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
                value={pw.pwNew}
                onChange={(e) => pw.setPwNew(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwNew(!pw.showPwNew)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  pw.showPwNew
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
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
            <Label
              htmlFor="rotation-confirm"
              className="mb-1.5 block text-sm font-medium"
            >
              Confirmer le nouveau mot de passe
            </Label>
            <div className="relative">
              <Input
                id="rotation-confirm"
                type={pw.showPwConfirm ? "text" : "password"}
                className="h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
                value={pw.pwConfirm}
                onChange={(e) => pw.setPwConfirm(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => pw.setShowPwConfirm(!pw.showPwConfirm)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  pw.showPwConfirm
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {pw.showPwConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <Button
              type="submit"
              className="h-9 rounded-[3px]"
              disabled={pw.savingPassword}
            >
              {pw.savingPassword && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Choisir ce mot de passe
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
