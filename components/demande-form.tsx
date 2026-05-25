"use client"

import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { PrototypeCityField } from "@/components/prototype-city/prototype-city-field"
import { PrototypeSwitcher } from "@/components/ui/prototype-switcher"
import { Loader2, Save, Send } from "lucide-react"
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

export function DemandeForm() {
  const { vehicules, saving, submitting, onSave, onSubmit } = useDemandeForm()

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
    },
  })

  const selectedMotifs = watch("motif")
  const typeTransport = watch("typeTransport")
  const avanceRequise = watch("avanceRequise")

  function toggleMotif(value: string) {
    const current = selectedMotifs
    if (current.includes(value)) {
      setValue("motif", current.filter((m) => m !== value))
    } else {
      setValue("motif", [...current, value])
    }
  }

  const showVehicleField = typeTransport === "VOITURE_SOCIETE"

  const total =
    (parseFloat(watch("fraisTransport") || "0")) +
    (parseFloat(watch("fraisHebergement") || "0")) +
    (parseFloat(watch("fraisRepas") || "0")) +
    (parseFloat(watch("fraisDivers") || "0"))

  return (
    <>
      <form className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande de déplacement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Motif du déplacement</Label>
              <div className="mt-2 grid gap-4 sm:gap-2 sm:grid-cols-2">
                {PURPOSE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedMotifs.includes(opt.value)}
                      onCheckedChange={() => toggleMotif(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {selectedMotifs.includes("autre") && (
                <Input
                  className="mt-2"
                  placeholder="Précisez le motif..."
                  {...register("motifAutre")}
                />
              )}
              {errors.motif && <p className="mt-1 text-xs text-destructive">{errors.motif.message}</p>}
            </div>

            <div className="space-y-3">
              <Label>Dates du déplacement</Label>
              <DateRangePicker
                dateDepart={watch("dateDepart")}
                dateRetour={watch("dateRetour")}
                onDateDepartChange={(v) => setValue("dateDepart", v)}
                onDateRetourChange={(v) => setValue("dateRetour", v)}
                errorDepart={errors.dateDepart?.message}
                errorRetour={errors.dateRetour?.message}
              />
            </div>

            <PrototypeCityField
              id="destination"
              value={watch("destination")}
              onValueChange={(v) => setValue("destination", v ?? "")}
              error={errors.destination?.message}
            />

            <div className="space-y-2">
              <Label>Moyen de transport</Label>
              <div className="grid gap-4 sm:gap-2 sm:grid-cols-3">
                {Object.entries(TRANSPORT_LABELS).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value={value}
                      checked={typeTransport === value}
                      onChange={(e) => setValue("typeTransport", e.target.value as FormValues["typeTransport"])}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {showVehicleField && vehicules.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="vehiculeId">Véhicule de société</Label>
                <select
                  id="vehiculeId"
                  {...register("vehiculeId")}
                  className="border-input flex h-8 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
              <div className="space-y-2">
                <Label htmlFor="autreTransport">Précisez le transport</Label>
                <Input id="autreTransport" placeholder="Autre moyen de transport..." {...register("autreTransport")} />
              </div>
            )}

            <div>
              <Label>Frais estimés (Dhs)</Label>
              <div className="mt-2 grid gap-4 sm:gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Transport</Label>
                  <Input type="number" min="0" step="0.01" {...register("fraisTransport")} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hébergement</Label>
                  <Input type="number" min="0" step="0.01" {...register("fraisHebergement")} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Repas</Label>
                  <Input type="number" min="0" step="0.01" {...register("fraisRepas")} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Divers</Label>
                  <Input type="number" min="0" step="0.01" {...register("fraisDivers")} />
                </div>
              </div>
              <p className="mt-2 text-right text-sm font-semibold">
                Total estimé : {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} Dhs
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={avanceRequise}
                onCheckedChange={(checked: boolean) => setValue("avanceRequise", checked)}
              />
              <Label>Avance sur frais demandée</Label>
            </div>
            {avanceRequise && (
              <div className="space-y-2">
                <Label htmlFor="montantAvance">Montant de l'avance (Dhs)</Label>
                <Input id="montantAvance" type="number" min="0" step="0.01" {...register("montantAvance")} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description détaillée</Label>
              <Textarea
                id="description"
                placeholder="Décrivez les détails de votre déplacement..."
                rows={4}
                {...register("description")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={handleSubmit(onSave)} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Save className="mr-2 size-4" />
            Sauvegarder le brouillon
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Send className="mr-2 size-4" />
            Soumettre la demande
          </Button>
        </div>
      </form>
      <Suspense fallback={null}>
        <PrototypeSwitcher />
      </Suspense>
    </>
  )
}
