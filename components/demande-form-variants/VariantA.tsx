"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CityCombobox } from "@/components/ui/city-combobox"
import { Loader2, Globe, Save, Send, Calendar, MapPin, Truck, DollarSign, Wallet, FileText, ClipboardList } from "lucide-react"
import { PURPOSE_OPTIONS, TRANSPORT_LABELS } from "@/lib/constants"
import { useDemandeForm } from "@/hooks/use-demande-form"
import { demandeSchema } from "@/lib/schemas"
import type { z } from "zod"

type FormValues = z.infer<typeof demandeSchema>

interface Vehicule {
  id: string
  nom: string
  immatriculation: string
  disponible: boolean
}

export function VariantA() {
  const { vehicules, saving, submitting, onSave, onSubmit } = useDemandeForm()
  const [horsMaroc, setHorsMaroc] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(demandeSchema),
    defaultValues: {
      motif: [],
      avanceRequise: false,
      horsMaroc: false,
    },
  })

  const selectedMotifs = watch("motif")
  const typeTransport = watch("typeTransport")
  const avanceRequise = watch("avanceRequise")

  function toggleMotif(value: string) {
    const current = selectedMotifs || []
    if (current.includes(value)) {
      setValue("motif", current.filter((m) => m !== value))
    } else {
      setValue("motif", [...current, value])
    }
  }

  const showVehicleField = typeTransport === "VOITURE_SOCIETE"

  const fTransport = parseFloat(watch("fraisTransport") || "0")
  const fHebergement = parseFloat(watch("fraisHebergement") || "0")
  const fRepas = parseFloat(watch("fraisRepas") || "0")
  const fDivers = parseFloat(watch("fraisDivers") || "0")
  const total = fTransport + fHebergement + fRepas + fDivers

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nouvelle Demande de Déplacement
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Formulaire d'enregistrement de votre déplacement professionnel pour approbation.
        </p>
      </div>

      <form className="space-y-8">
        {/* Section 1: Motif & Description */}
        <Card className="border border-zinc-150 dark:border-zinc-800 shadow-md">
          <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Motif & Contexte</CardTitle>
                <CardDescription>Indiquez la raison de votre voyage d'affaires</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-sm font-semibold">Motif(s) du déplacement</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PURPOSE_OPTIONS.map((opt) => {
                  const isChecked = selectedMotifs?.includes(opt.value)
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer select-none transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5 text-primary-foreground font-medium"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleMotif(opt.value)}
                        className={isChecked ? "border-primary" : ""}
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
              {selectedMotifs?.includes("autre") && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-250">
                  <Label htmlFor="motifAutre" className="text-xs text-zinc-500">Précisez le motif</Label>
                  <Input
                    id="motifAutre"
                    className="mt-1"
                    placeholder="Saisissez la raison détaillée..."
                    {...register("motifAutre")}
                  />
                </div>
              )}
              {errors.motif && (
                <p className="mt-2 text-xs text-destructive font-medium flex items-center gap-1">
                  <span>⚠️</span> {errors.motif.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold">Description détaillée</Label>
              <Textarea
                id="description"
                placeholder="Décrivez les objectifs, le programme et les détails de votre déplacement..."
                rows={3}
                className="resize-none"
                {...register("description")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Destination & Dates */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card: Dates */}
          <Card className="border border-zinc-150 dark:border-zinc-800 shadow-md">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Dates de voyage</CardTitle>
                  <CardDescription>Départ et retour prévus</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <DateRangePicker
                dateDepart={watch("dateDepart")}
                dateRetour={watch("dateRetour")}
                onDateDepartChange={(v) => setValue("dateDepart", v)}
                onDateRetourChange={(v) => setValue("dateRetour", v)}
                errorDepart={errors.dateDepart?.message}
                errorRetour={errors.dateRetour?.message}
              />
            </CardContent>
          </Card>

          {/* Card: Destination */}
          <Card className="border border-zinc-150 dark:border-zinc-800 shadow-md">
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Destination</CardTitle>
                  <CardDescription>Lieu ciblé du déplacement</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="destination" className="text-sm font-semibold">Ville de destination</Label>
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
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
                    className="accent-primary size-4 rounded border-zinc-300"
                  />
                </label>
              </div>

              {horsMaroc ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <Input
                    id="destination"
                    placeholder="Saisissez le pays et la ville de destination..."
                    {...register("destination")}
                    className={errors.destination?.message ? "border-destructive focus-visible:ring-destructive/20" : ""}
                  />
                  {errors.destination && (
                    <p className="mt-1.5 text-xs text-destructive font-medium">{errors.destination.message}</p>
                  )}
                </div>
              ) : (
                <CityCombobox
                  id="destination"
                  label=""
                  value={watch("destination")}
                  onValueChange={(v) => setValue("destination", v ?? "")}
                  error={errors.destination?.message}
                  placeholder="Sélectionner une ville du Maroc..."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Transport */}
        <Card className="border border-zinc-150 dark:border-zinc-800 shadow-md">
          <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Truck className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Moyen de transport</CardTitle>
                <CardDescription>Sélectionnez le mode de déplacement logistique</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {Object.entries(TRANSPORT_LABELS).map(([value, label]) => {
                const isSelected = typeTransport === value
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border cursor-pointer select-none transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary-foreground font-medium"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <input
                      type="radio"
                      value={value}
                      checked={isSelected}
                      onChange={(e) => setValue("typeTransport", e.target.value as FormValues["typeTransport"])}
                      className="accent-primary size-4"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                  </label>
                )
              })}
            </div>

            {showVehicleField && vehicules.length > 0 && (
              <div className="space-y-2 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-250">
                <Label htmlFor="vehiculeId" className="text-sm font-semibold">Véhicule de société disponible</Label>
                <select
                  id="vehiculeId"
                  {...register("vehiculeId")}
                  className="mt-1 border-zinc-200 dark:border-zinc-800 flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">-- Choisir un véhicule dans le parc --</option>
                  {vehicules.filter((v: Vehicule) => v.disponible).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nom} — [{v.immatriculation}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {typeTransport === "AUTRE" && (
              <div className="space-y-2 animate-in fade-in duration-250">
                <Label htmlFor="autreTransport" className="text-sm font-semibold">Précisez le moyen de transport</Label>
                <Input
                  id="autreTransport"
                  placeholder="Ex: Covoiturage, taxi, bus touristique..."
                  {...register("autreTransport")}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Budget & Avance */}
        <Card className="border border-zinc-150 dark:border-zinc-800 shadow-md">
          <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Budget Estimé & Demande d'Avance</CardTitle>
                <CardDescription>Estimation des coûts du déplacement en Dirhams (Dhs)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500 font-medium">Frais de Transport</Label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" {...register("fraisTransport")} className="pr-10" />
                  <span className="absolute right-3 top-2 text-xs text-zinc-400">Dhs</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500 font-medium">Hébergement</Label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" {...register("fraisHebergement")} className="pr-10" />
                  <span className="absolute right-3 top-2 text-xs text-zinc-400">Dhs</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500 font-medium">Repas / Restauration</Label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" {...register("fraisRepas")} className="pr-10" />
                  <span className="absolute right-3 top-2 text-xs text-zinc-400">Dhs</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500 font-medium">Divers / Autres</Label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" {...register("fraisDivers")} className="pr-10" />
                  <span className="absolute right-3 top-2 text-xs text-zinc-400">Dhs</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Budget total estimé</span>
              <span className="text-lg font-bold text-primary">
                {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} Dhs
              </span>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={avanceRequise}
                  onCheckedChange={(checked: boolean) => {
                    setValue("avanceRequise", checked)
                    if (!checked) setValue("montantAvance", "")
                  }}
                />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Demander une avance sur frais
                </span>
              </label>

              {avanceRequise && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg animate-in fade-in duration-250">
                  <Label htmlFor="montantAvance" className="text-sm font-semibold">Montant de l'avance demandée</Label>
                  <div className="mt-2 max-w-xs relative">
                    <Input id="montantAvance" type="number" min="0" step="0.01" {...register("montantAvance")} className="pr-10" />
                    <span className="absolute right-3 top-2 text-xs text-zinc-400">Dhs</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
                    <Wallet className="size-3.5" />
                    <span>L'avance est généralement plafonnée selon la politique interne de l'entreprise.</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit((data) => onSave({ ...data, horsMaroc }))}
            disabled={saving || submitting}
            className="w-full sm:w-auto h-11"
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Sauvegarder le brouillon
          </Button>
          <Button
            type="button"
            onClick={handleSubmit((data) => onSubmit({ ...data, horsMaroc }))}
            disabled={submitting || saving}
            className="w-full sm:w-auto h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Soumettre la demande
          </Button>
        </div>
      </form>
    </div>
  )
}
