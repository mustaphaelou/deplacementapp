"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CityCombobox } from "@/components/ui/city-combobox"
import { Loader2, Globe, Save, Send, Calendar, MapPin, Truck, DollarSign, Wallet, FileText, ClipboardList, Info, PlaneTakeoff } from "lucide-react"
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

export function VariantC() {
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
  const destination = watch("destination")
  const dateDepart = watch("dateDepart")
  const dateRetour = watch("dateRetour")
  const description = watch("description")

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

  // Calculate duration in days
  let totalDays = 0
  if (dateDepart && dateRetour) {
    const start = new Date(dateDepart)
    const end = new Date(dateRetour)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime()
      if (diffTime >= 0) {
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Création de Déplacement
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Saisissez vos données à gauche et examinez votre fiche récapitulative en temps réel à droite.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Form (7 cols) */}
        <form className="lg:col-span-7 space-y-6">
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardContent className="p-6 space-y-6">
              {/* Section 1: Motif */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" />
                  Motif du déplacement
                </Label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PURPOSE_OPTIONS.map((opt) => {
                    const active = selectedMotifs?.includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-3.5 py-2.5 border rounded-lg cursor-pointer transition-all ${
                          active
                            ? "border-primary bg-primary/5 text-primary-foreground font-medium"
                            : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={() => toggleMotif(opt.value)}
                        />
                        <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
                {selectedMotifs?.includes("autre") && (
                  <div className="animate-in fade-in duration-200">
                    <Input placeholder="Veuillez préciser le motif..." {...register("motifAutre")} />
                  </div>
                )}
                {errors.motif && (
                  <p className="text-xs text-destructive">⚠️ {errors.motif.message}</p>
                )}
              </div>

              {/* Section 2: Destination & Dates */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    Période de voyage
                  </Label>
                  <DateRangePicker
                    dateDepart={watch("dateDepart")}
                    dateRetour={watch("dateRetour")}
                    onDateDepartChange={(v) => setValue("dateDepart", v)}
                    onDateRetourChange={(v) => setValue("dateRetour", v)}
                    errorDepart={errors.dateDepart?.message}
                    errorRetour={errors.dateRetour?.message}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="destination" className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="size-4 text-primary" />
                      Destination
                    </Label>
                    <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
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
                        className="accent-primary size-4"
                      />
                    </label>
                  </div>

                  {horsMaroc ? (
                    <div className="animate-in fade-in duration-200">
                      <Input
                        id="destination"
                        placeholder="Ex: Paris, France..."
                        {...register("destination")}
                        className={errors.destination?.message ? "border-destructive" : ""}
                      />
                      {errors.destination && (
                        <p className="mt-1 text-xs text-destructive">{errors.destination.message}</p>
                      )}
                    </div>
                  ) : (
                    <CityCombobox
                      id="destination"
                      label=""
                      value={watch("destination")}
                      onValueChange={(v) => setValue("destination", v ?? "")}
                      error={errors.destination?.message}
                      placeholder="Indiquez la ville du Maroc..."
                    />
                  )}
                </div>
              </div>

              {/* Section 3: Transport */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="size-4 text-primary" />
                  Moyen de transport
                </Label>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {Object.entries(TRANSPORT_LABELS).map(([value, label]) => {
                    const active = typeTransport === value
                    return (
                      <label
                        key={value}
                        className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-lg cursor-pointer transition-all ${
                          active
                            ? "border-primary bg-primary/5 text-primary-foreground font-medium"
                            : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          value={value}
                          checked={active}
                          onChange={(e) => setValue("typeTransport", e.target.value as FormValues["typeTransport"])}
                          className="accent-primary size-3.5"
                        />
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
                      </label>
                    )
                  })}
                </div>

                {showVehicleField && vehicules.length > 0 && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border rounded-lg space-y-2 animate-in fade-in duration-200">
                    <Label htmlFor="vehiculeId" className="text-xs font-semibold">Parc automobile disponible</Label>
                    <select
                      id="vehiculeId"
                      {...register("vehiculeId")}
                      className="border-zinc-200 flex h-9 w-full rounded-md border bg-background px-2 text-xs shadow-xs outline-none"
                    >
                      <option value="">Sélectionner un véhicule</option>
                      {vehicules.filter((v: Vehicule) => v.disponible).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nom} ({v.immatriculation})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {typeTransport === "AUTRE" && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <Label htmlFor="autreTransport" className="text-xs">Préciser le transport</Label>
                    <Input id="autreTransport" placeholder="Autre moyen..." {...register("autreTransport")} />
                  </div>
                )}
              </div>

              {/* Section 4: Budget */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" />
                  Budget prévisionnel (Dhs)
                </Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-zinc-500">Transport</Label>
                    <Input type="number" min="0" step="0.01" {...register("fraisTransport")} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Hébergement</Label>
                    <Input type="number" min="0" step="0.01" {...register("fraisHebergement")} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Repas</Label>
                    <Input type="number" min="0" step="0.01" {...register("fraisRepas")} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Divers / Imprévus</Label>
                    <Input type="number" min="0" step="0.01" {...register("fraisDivers")} />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={avanceRequise}
                      onCheckedChange={(checked: boolean) => {
                        setValue("avanceRequise", checked)
                        if (!checked) setValue("montantAvance", "")
                      }}
                    />
                    <span className="text-xs sm:text-sm font-semibold">Solliciter une avance de trésorerie</span>
                  </label>

                  {avanceRequise && (
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border rounded-lg max-w-xs animate-in fade-in duration-200">
                      <Label htmlFor="montantAvance" className="text-xs font-semibold">Montant de l'avance (Dhs)</Label>
                      <Input id="montantAvance" type="number" min="0" step="0.01" {...register("montantAvance")} className="mt-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 5: Description */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Description / Commentaires
                </Label>
                <Textarea
                  id="description"
                  placeholder="Informations supplémentaires (objectifs, clients rencontrés, etc.)..."
                  rows={3}
                  {...register("description")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSubmit((data) => onSave({ ...data, horsMaroc }))}
              disabled={saving || submitting}
              className="flex-1"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Save className="mr-2 size-4" />
              Brouillon
            </Button>
            <Button
              type="button"
              onClick={handleSubmit((data) => onSubmit({ ...data, horsMaroc }))}
              disabled={submitting || saving}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Send className="mr-2 size-4" />
              Soumettre
            </Button>
          </div>
        </form>

        {/* Right Column: Ticket (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-6">
          <div className="relative bg-zinc-900 dark:bg-zinc-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-850">
            {/* Top Badge/Header */}
            <div className="px-6 py-4 bg-primary text-primary-foreground font-semibold flex items-center justify-between border-b border-primary/20">
              <div className="flex items-center gap-2 text-sm tracking-wide">
                <PlaneTakeoff className="size-4" />
                FICHE DE DÉPLACEMENT
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">TEMPS RÉEL</span>
            </div>

            <div className="p-6 space-y-6">
              {/* Route segment */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-zinc-400 uppercase">Origine</span>
                  <span className="text-sm font-semibold">Siège Société</span>
                </div>
                <div className="flex-1 flex items-center justify-center px-4 relative">
                  <div className="h-0.5 w-full bg-dashed bg-zinc-700" />
                  <span className="absolute text-xs bg-zinc-900 dark:bg-zinc-950 px-2 text-zinc-400">
                    {totalDays > 0 ? `${totalDays} ${totalDays > 1 ? "jours" : "jour"}` : "Non défini"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-zinc-400 uppercase">Destination</span>
                  <span className="text-sm font-bold text-primary-foreground">
                    {destination || (
                      <span className="italic text-zinc-600">À sélectionner</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-800/40 rounded-lg border border-zinc-800">
                <div>
                  <span className="block text-[9px] text-zinc-400 uppercase">Date Départ</span>
                  <span className="text-xs font-semibold text-zinc-200">
                    {dateDepart ? new Date(dateDepart).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] text-zinc-400 uppercase text-right">Date Retour</span>
                  <span className="text-xs font-semibold text-zinc-200 block text-right">
                    {dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                  </span>
                </div>
              </div>

              {/* Motifs summary */}
              <div>
                <span className="block text-[10px] text-zinc-400 uppercase mb-2">Motifs du voyage</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMotifs && selectedMotifs.length > 0 ? (
                    selectedMotifs.map((val) => {
                      const label = PURPOSE_OPTIONS.find((o) => o.value === val)?.label || val
                      return (
                        <span key={val} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700">
                          {label}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-xs italic text-zinc-600">Aucun motif sélectionné</span>
                  )}
                </div>
              </div>

              {/* Transport mode */}
              <div className="flex items-center justify-between py-2 border-t border-b border-zinc-800">
                <span className="text-xs text-zinc-400">Transport choisi</span>
                <span className="text-xs font-semibold text-zinc-200">
                  {typeTransport ? TRANSPORT_LABELS[typeTransport] || typeTransport : "Non spécifié"}
                </span>
              </div>

              {/* Cost breakdown */}
              <div className="space-y-2">
                <span className="block text-[10px] text-zinc-400 uppercase">Estimation financière</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Transport:</span>
                    <span className="font-medium text-zinc-200">{fTransport.toFixed(2)} Dhs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Hébergement:</span>
                    <span className="font-medium text-zinc-200">{fHebergement.toFixed(2)} Dhs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Repas:</span>
                    <span className="font-medium text-zinc-200">{fRepas.toFixed(2)} Dhs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Divers:</span>
                    <span className="font-medium text-zinc-200">{fDivers.toFixed(2)} Dhs</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-800 text-sm font-bold">
                    <span>Total Estimé:</span>
                    <span className="text-primary-foreground">{total.toFixed(2)} Dhs</span>
                  </div>
                </div>
              </div>

              {/* Avance reminder */}
              {avanceRequise && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Wallet className="size-3.5" />
                    Demande d'avance active
                  </div>
                  <div>
                    Montant souhaité: <span className="font-bold text-white">{parseFloat(watch("montantAvance") || "0").toFixed(2)} Dhs</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Footer details */}
            <div className="px-6 py-4 bg-zinc-950 text-zinc-500 text-[10px] flex items-center justify-between border-t border-zinc-900">
              <span>DEMANDE DE DÉPLACEMENT</span>
              <span>MustaphaElou</span>
            </div>
          </div>

          {/* Guidelines box */}
          <div className="p-4 bg-blue-50/50 dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800 rounded-xl flex gap-3 text-xs text-zinc-650 dark:text-zinc-450 leading-relaxed">
            <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-800 dark:text-zinc-300 mb-1">Processus de validation :</p>
              Votre demande transitera par votre Responsable Hiérarchique (Manager) puis par l'Administration Finance avant validation finale par la Direction.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
