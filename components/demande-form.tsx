"use client"

import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CityCombobox } from "@/components/ui/city-combobox"
import {
  Loader2,
  Globe,
  Save,
  Send,
  Calendar,
  Truck,
  DollarSign,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { PURPOSE_OPTIONS, TRANSPORT_LABELS } from "@/lib/constants"
import { useDemandeForm } from "@/hooks/use-demande-form"
import { demandeSchema, type DemandeFormValues } from "@/lib/schemas"
import type { Vehicule } from "@/lib/demande-types"

type FormValues = DemandeFormValues

const STEPS = [
  { label: "Motif", desc: "Raison du déplacement" },
  { label: "Voyage", desc: "Dates et destination" },
  { label: "Logistique", desc: "Transport & Véhicule" },
  { label: "Budget", desc: "Frais & Avance" },
]

export function DemandeForm() {
  const { vehicules, saving, submitting, onSave, onSubmit } = useDemandeForm()
  const [step, setStep] = useState(0)
  const [horsMaroc, setHorsMaroc] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(demandeSchema),
    defaultValues: {
      motif: [],
      avanceRequise: false,
      horsMaroc: false,
    },
  })

  const selectedMotifs = useWatch({ control, name: "motif" })
  const typeTransport = useWatch({ control, name: "typeTransport" })
  const avanceRequise = useWatch({ control, name: "avanceRequise" })
  const fTransport = parseFloat(
    useWatch({ control, name: "fraisTransport" }) || "0"
  )
  const fHebergement = parseFloat(
    useWatch({ control, name: "fraisHebergement" }) || "0"
  )
  const fRepas = parseFloat(useWatch({ control, name: "fraisRepas" }) || "0")
  const fDivers = parseFloat(useWatch({ control, name: "fraisDivers" }) || "0")
  const total = fTransport + fHebergement + fRepas + fDivers
  const dateDepart = useWatch({ control, name: "dateDepart" })
  const dateRetour = useWatch({ control, name: "dateRetour" })
  const destination = useWatch({ control, name: "destination" })

  function toggleMotif(value: string) {
    const current = selectedMotifs || []
    if (current.includes(value)) {
      setValue(
        "motif",
        current.filter((m) => m !== value)
      )
    } else {
      setValue("motif", [...current, value])
    }
  }

  const showVehicleField = typeTransport === "VOITURE_SOCIETE"

  const handleNext = async () => {
    let fieldsToValidate: (keyof FormValues)[] = []

    if (step === 0) {
      fieldsToValidate = ["motif", "motifAutre", "description"]
    } else if (step === 1) {
      fieldsToValidate = ["dateDepart", "dateRetour", "destination"]
    } else if (step === 2) {
      fieldsToValidate = ["typeTransport", "autreTransport", "vehiculeId"]
    }

    const isValid = await trigger(fieldsToValidate)
    if (isValid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Title */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nouvelle Demande de Déplacement
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Assistant pas-à-pas pour remplir votre demande.
        </p>
      </div>

      {/* Steper indicator */}
      <div className="mb-8">
        <div className="relative flex items-center justify-between">
          {/* Progress bar background line */}
          <div className="absolute top-1/2 right-0 left-0 z-0 h-0.5 -translate-y-1/2 bg-zinc-200 dark:bg-zinc-800" />
          {/* Progress active bar line */}
          <div
            className="absolute top-1/2 left-0 z-0 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((s, idx) => {
            const isCompleted = idx < step
            const isActive = idx === step
            return (
              <div
                key={idx}
                className="relative z-10 flex flex-col items-center"
              >
                <button
                  type="button"
                  onClick={async () => {
                    // Only allow clicking steps before current step or if current step validates
                    if (idx < step) {
                      setStep(idx)
                    } else if (idx > step) {
                      // Trigger validation of intermediary steps
                      let canNavigate = true
                      for (let i = step; i < idx; i++) {
                        let fields: (keyof FormValues)[] = []
                        if (i === 0)
                          fields = ["motif", "motifAutre", "description"]
                        if (i === 1)
                          fields = ["dateDepart", "dateRetour", "destination"]
                        if (i === 2)
                          fields = [
                            "typeTransport",
                            "autreTransport",
                            "vehiculeId",
                          ]
                        const valid = await trigger(fields)
                        if (!valid) {
                          canNavigate = false
                          setStep(i)
                          break
                        }
                      }
                      if (canNavigate) {
                        setStep(idx)
                      }
                    }
                  }}
                  className={`flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "scale-110 border-primary bg-background text-primary shadow-md"
                        : "border-zinc-200 bg-background text-zinc-400 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-600"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </button>
                <div className="absolute top-11 flex w-28 flex-col items-center text-center">
                  <span
                    className={`text-xs font-semibold ${isActive ? "font-bold text-primary" : "text-zinc-500"}`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <form className="mt-14 space-y-6">
        {/* Step contents */}
        {step === 0 && (
          <Card className="animate-in border border-zinc-200 shadow-lg duration-300 fade-in dark:border-zinc-800">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <ClipboardList className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    Étape 1: Motif & Contexte
                  </CardTitle>
                  <CardDescription>
                    Quelle est la raison de ce déplacement ?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div>
                <Label className="text-sm font-semibold">Motifs</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {PURPOSE_OPTIONS.map((opt) => {
                    const checked = selectedMotifs?.includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                          checked
                            ? "border-primary bg-primary/5 text-primary-foreground"
                            : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMotif(opt.value)}
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {opt.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {selectedMotifs?.includes("autre") && (
                  <div className="mt-4">
                    <Label
                      htmlFor="motifAutre"
                      className="text-xs text-zinc-400"
                    >
                      Précisez le motif
                    </Label>
                    <Input
                      id="motifAutre"
                      className="mt-1"
                      {...register("motifAutre")}
                      placeholder="Autre motif..."
                    />
                  </div>
                )}
                {errors.motif && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    ⚠️ {errors.motif.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold">
                  Description détaillée
                </Label>
                <Textarea
                  id="description"
                  placeholder="Objectif de la mission, réunions prévues, etc."
                  rows={4}
                  {...register("description")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="animate-in border border-zinc-200 shadow-lg duration-300 fade-in dark:border-zinc-800">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    Étape 2: Destination & Dates
                  </CardTitle>
                  <CardDescription>Où et quand voyagez-vous ?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Dates de déplacement
                </Label>
                <DateRangePicker
                  dateDepart={dateDepart}
                  dateRetour={dateRetour}
                  onDateDepartChange={(v) => setValue("dateDepart", v)}
                  onDateRetourChange={(v) => setValue("dateRetour", v)}
                  errorDepart={errors.dateDepart?.message}
                  errorRetour={errors.dateRetour?.message}
                />
              </div>

              <div className="space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="destination"
                    className="text-sm font-semibold"
                  >
                    Ville de destination
                  </Label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 select-none">
                    <Globe className="size-3.5" />
                    <span>Hors Maroc</span>
                    <input
                      type="checkbox"
                      checked={horsMaroc}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setHorsMaroc(checked)
                        setValue("horsMaroc", checked)
                        setValue("destination", "")
                      }}
                      className="size-4 accent-primary"
                    />
                  </label>
                </div>

                {horsMaroc ? (
                  <div className="animate-in duration-200 fade-in">
                    <Input
                      id="destination"
                      placeholder="Indiquer la destination internationale..."
                      {...register("destination")}
                      className={
                        errors.destination?.message ? "border-destructive" : ""
                      }
                    />
                    {errors.destination && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.destination.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <CityCombobox
                    id="destination"
                    label=""
                    value={destination}
                    onValueChange={(v) => setValue("destination", v ?? "")}
                    error={errors.destination?.message}
                    placeholder="Sélectionner la ville de destination..."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="animate-in border border-zinc-200 shadow-lg duration-300 fade-in dark:border-zinc-800">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <Truck className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    Étape 3: Transport & Logistique
                  </CardTitle>
                  <CardDescription>
                    Comment allez-vous vous déplacer ?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Moyen de transport principal
                </Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(TRANSPORT_LABELS).map(([value, label]) => {
                    const active = typeTransport === value
                    return (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                          active
                            ? "border-primary bg-primary/5 font-medium text-primary-foreground"
                            : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800"
                        }`}
                      >
                        <input
                          type="radio"
                          value={value}
                          checked={active}
                          onChange={(e) =>
                            setValue(
                              "typeTransport",
                              e.target.value as FormValues["typeTransport"]
                            )
                          }
                          className="accent-primary"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {showVehicleField && vehicules.length > 0 && (
                <div className="animate-in space-y-2 rounded-lg border bg-zinc-50 p-4 duration-200 fade-in dark:bg-zinc-900">
                  <Label htmlFor="vehiculeId" className="text-sm font-semibold">
                    Véhicule de société
                  </Label>
                  <select
                    id="vehiculeId"
                    {...register("vehiculeId")}
                    className="mt-1 flex h-10 w-full rounded-md border border-zinc-200 bg-background px-3 text-sm shadow-xs focus-visible:outline-hidden"
                  >
                    <option value="">
                      Sélectionner un véhicule disponible
                    </option>
                    {vehicules
                      .filter((v: Vehicule) => v.disponible)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nom} ({v.immatriculation})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {typeTransport === "AUTRE" && (
                <div className="animate-in space-y-2 duration-200 fade-in">
                  <Label
                    htmlFor="autreTransport"
                    className="text-sm font-semibold"
                  >
                    Précisez le moyen de transport
                  </Label>
                  <Input
                    id="autreTransport"
                    placeholder="Autre moyen..."
                    {...register("autreTransport")}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="animate-in border border-zinc-200 shadow-lg duration-300 fade-in dark:border-zinc-800">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <DollarSign className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">
                    Étape 4: Budget & Avance
                  </CardTitle>
                  <CardDescription>
                    Estimez vos frais de déplacement
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium text-zinc-500">
                    Frais Transport (Dhs)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("fraisTransport")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-500">
                    Hébergement (Dhs)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("fraisHebergement")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-500">
                    Repas (Dhs)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("fraisRepas")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-500">
                    Divers (Dhs)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("fraisDivers")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
                <span className="text-sm font-semibold">Total estimé</span>
                <span className="text-lg font-bold text-primary">
                  {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                  Dhs
                </span>
              </div>

              <div className="space-y-4 border-t pt-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={avanceRequise}
                    onCheckedChange={(checked: boolean) => {
                      setValue("avanceRequise", checked)
                      if (!checked) setValue("montantAvance", "")
                    }}
                  />
                  <span className="text-sm font-semibold">
                    Demander une avance sur frais
                  </span>
                </label>

                {avanceRequise && (
                  <div className="animate-in space-y-2 rounded-lg border bg-zinc-50 p-4 duration-200 fade-in dark:bg-zinc-900">
                    <Label
                      htmlFor="montantAvance"
                      className="text-sm font-semibold"
                    >
                      Montant de l&apos;avance (Dhs)
                    </Label>
                    <Input
                      id="montantAvance"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register("montantAvance")}
                      className="max-w-xs"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrev}
            disabled={step === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Précédent
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 bg-primary text-primary-foreground"
            >
              Suivant
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSubmit((data) => onSave({ ...data, horsMaroc }))}
                disabled={saving || submitting}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Save className="mr-2 size-4" />
                Brouillon
              </Button>
              <Button
                type="button"
                onClick={handleSubmit((data) =>
                  onSubmit({ ...data, horsMaroc })
                )}
                disabled={submitting || saving}
              >
                {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Send className="mr-2 size-4" />
                Soumettre
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
