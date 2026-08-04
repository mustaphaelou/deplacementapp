"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signInWithCredentials } from "@/lib/auth/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { setupWizardSchema, type SetupWizardValues } from "@/lib/schemas"
import {
  PasswordStrength,
  checkPasswordEntropy,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  getPasswordStrengthWidth,
} from "@/lib/password-strength"
import { cn } from "@/lib/utils"

const AUTH_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
const PRIMARY_BUTTON =
  "h-9 rounded-[3px] shadow-[0_1px_2px_rgba(15,15,15,0.1)] hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]"

const STEP_FIELDS: Record<number, (keyof SetupWizardValues)[]> = {
  1: ["societeNom", "nomExpediteurEmail"],
  2: ["departements"],
  3: [
    "prenom",
    "nom",
    "email",
    "poste",
    "password",
    "confirmPassword",
    "departementNom",
  ],
}

export function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [departements, setDepartements] = useState<string[]>([])
  const [newDepartement, setNewDepartement] = useState("")
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<SetupWizardValues>({
    resolver: zodResolver(setupWizardSchema),
    defaultValues: {
      departements: [],
    },
  })

  const watchedPassword = useWatch({ control, name: "password" })
  const watchedDepartementNom = useWatch({ control, name: "departementNom" })
  const watchedSocieteNom = useWatch({ control, name: "societeNom" })
  const passwordStrength = watchedPassword
    ? checkPasswordEntropy(watchedPassword)
    : null

  const autoFilledExpediteur = useRef(false)
  useEffect(() => {
    if (watchedSocieteNom && !autoFilledExpediteur.current) {
      setValue("nomExpediteurEmail", watchedSocieteNom)
      autoFilledExpediteur.current = true
    }
  }, [watchedSocieteNom, setValue])

  function syncDepartements(deps: string[]) {
    setDepartements(deps)
    setValue("departements", deps, { shouldValidate: true })
  }

  function addDepartement(e: React.FormEvent) {
    e.preventDefault()
    const name = newDepartement.trim()
    if (!name) return
    if (!departements.includes(name)) {
      syncDepartements([...departements, name])
    }
    setNewDepartement("")
  }

  function removeDepartement(name: string) {
    syncDepartements(departements.filter((d) => d !== name))
  }

  async function goToStep2() {
    const valid = await trigger(STEP_FIELDS[1])
    if (!valid) return
    setStep(2)
  }

  async function goToStep3() {
    const valid = await trigger(STEP_FIELDS[2])
    if (!valid) return
    if (departements.length > 0) {
      setValue("departementNom", departements[0], { shouldValidate: true })
    }
    setStep(3)
  }

  async function onSubmit(data: SetupWizardValues) {
    setLoading(true)

    const res = await fetch("/api/setup/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        societeNom: data.societeNom,
        societeEmailDomain: data.societeEmailDomain || undefined,
        departements: data.departements,
        nomExpediteurEmail: data.nomExpediteurEmail,
        admin: {
          email: data.email,
          password: data.password,
          nom: data.nom,
          prenom: data.prenom,
          poste: data.poste,
          departementNom: data.departementNom,
        },
      }),
    })

    if (!res.ok) {
      setLoading(false)
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || "Erreur lors de la configuration")
      return
    }

    const result = await signInWithCredentials(data.email, data.password)

    if (result?.error) {
      setLoading(false)
      toast.success("Compte créé — veuillez vous connecter")
      window.location.assign("/login")
      return
    }

    toast.success("Configuration terminée — bienvenue !")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-[420px] max-w-full">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Configuration initiale
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          {step === 1
            ? "Informations de la société (1/3)"
            : step === 2
              ? "Départements de l'organisation (2/3)"
              : "Compte administrateur (3/3)"}
        </p>
        {step === 1 ? (
          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="societe-nom">Nom de la société</Label>
              <Input
                id="societe-nom"
                placeholder="Ma Société SARL"
                className={AUTH_INPUT}
                {...register("societeNom")}
                aria-invalid={!!errors.societeNom}
              />
              {errors.societeNom && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.societeNom.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="societe-email-domain">
                Domaine email{" "}
                <span className="text-xs text-muted-foreground">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="societe-email-domain"
                placeholder="masociete.ma"
                className={AUTH_INPUT}
                {...register("societeEmailDomain")}
              />
              <p className="text-xs text-muted-foreground">
                Exemple: masociete.ma → noreply@masociete.ma
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom-expediteur-email">
                Nom d&apos;expéditeur email
              </Label>
              <Input
                id="nom-expediteur-email"
                placeholder={watchedSocieteNom || "Nom de l'expéditeur"}
                className={AUTH_INPUT}
                {...register("nomExpediteurEmail")}
                aria-invalid={!!errors.nomExpediteurEmail}
              />
              {errors.nomExpediteurEmail && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.nomExpediteurEmail.message}
                </p>
              )}
            </div>
            <Button
              type="button"
              className={cn("w-full", PRIMARY_BUTTON)}
              onClick={goToStep2}
            >
              Continuer
            </Button>
          </div>
        ) : step === 2 ? (
          <div className="mt-8 space-y-4">
            {departements.length > 0 ? (
              <ul className="space-y-2">
                {departements.map((dep) => (
                  <li
                    key={dep}
                    className="flex items-center justify-between border border-input px-3 py-2 text-sm"
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
            {errors.departements && (
              <p className="text-xs text-destructive">
                {errors.departements.message}
              </p>
            )}
            <form onSubmit={addDepartement} className="flex gap-2">
              <Input
                placeholder="Nom du département"
                className={AUTH_INPUT}
                value={newDepartement}
                onChange={(e) => setNewDepartement(e.target.value)}
              />
              <Button type="submit" variant="ghost" className="h-9 rounded-[3px]">
                <Plus />
                Ajouter
              </Button>
            </form>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-[3px]"
                onClick={() => setStep(1)}
              >
                Retour
              </Button>
              <Button
                type="button"
                className={cn("flex-1", PRIMARY_BUTTON)}
                disabled={departements.length === 0}
                onClick={goToStep3}
              >
                Continuer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  placeholder="Sara"
                  className={AUTH_INPUT}
                  {...register("prenom")}
                  aria-invalid={!!errors.prenom}
                />
                {errors.prenom && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.prenom.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  placeholder="Alaoui"
                  className={AUTH_INPUT}
                  {...register("nom")}
                  aria-invalid={!!errors.nom}
                />
                {errors.nom && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.nom.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-email">Email</Label>
              <Input
                id="setup-email"
                type="email"
                placeholder="vous@exemple.ma"
                className={AUTH_INPUT}
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="poste">Poste</Label>
              <Input
                id="poste"
                placeholder="Directeur Général"
                className={AUTH_INPUT}
                {...register("poste")}
                aria-invalid={!!errors.poste}
              />
              {errors.poste && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.poste.message}
                </p>
              )}
            </div>
            <Select
              label="Département"
              value={watchedDepartementNom ?? ""}
              onValueChange={(v) => {
                if (v) setValue("departementNom", v, { shouldValidate: true })
              }}
            >
              {departements.map((dep) => (
                <SelectItem key={dep} value={dep}>
                  {dep}
                </SelectItem>
              ))}
            </Select>
            {errors.departementNom && (
              <p className="text-xs text-destructive">
                {errors.departementNom.message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="setup-password">Mot de passe</Label>
              <Input
                id="setup-password"
                type="password"
                placeholder="8 caractères minimum"
                className={AUTH_INPUT}
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
              {watchedPassword &&
                watchedPassword.length >= 8 &&
                passwordStrength !== null && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)} ${getPasswordStrengthWidth(passwordStrength)}`}
                      />
                    </div>
                    <p
                      className={`text-xs ${passwordStrength >= PasswordStrength.Moderate ? "text-muted-foreground" : "text-destructive"}`}
                    >
                      Mot de passe :{" "}
                      {getPasswordStrengthLabel(passwordStrength)}
                    </p>
                  </div>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                className={AUTH_INPUT}
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-[3px]"
                onClick={() => setStep(2)}
                disabled={loading}
              >
                Retour
              </Button>
              <Button
                type="submit"
                className={cn("flex-1", PRIMARY_BUTTON)}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Terminer la configuration
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
