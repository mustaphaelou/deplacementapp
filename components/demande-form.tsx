"use client"

import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { CityCombobox } from "@/components/ui/city-combobox"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Loader2,
  Globe,
  Save,
  Send,
  MapPin,
} from "lucide-react"
import { PURPOSE_OPTIONS, TRANSPORT_LABELS } from "@/lib/constants"
import { useDemandeForm } from "@/hooks/use-demande-form"
import { demandeSchema, type DemandeFormValues } from "@/lib/schemas"
import type { Vehicule } from "@/lib/demande-types"

type FormValues = DemandeFormValues

const FIELD_INPUT =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {children}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

export function DemandeForm() {
  const { vehicules, saving, submitting, onSave, onSubmit } = useDemandeForm()
  const [horsMaroc, setHorsMaroc] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
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

  return (
    <div className="mx-auto w-full max-w-[720px] pb-8">
      {/* Page header */}
      <div>
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Espace</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Link href="/demandes" className="transition-colors hover:text-foreground">
                  Demandes de déplacement
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  Nouvelle Demande
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-primary/10">
            <MapPin className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[40px] leading-tight font-bold tracking-[-0.01em]">
              Nouvelle Demande
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Renseignez les informations du déplacement. Certains champs
              peuvent être pré-remplis automatiquement.
            </p>
          </div>
        </div>
      </div>

      <form className="mt-10 space-y-10">
        {/* Motif & contexte */}
        <section>
          <SectionHeading>Motif &amp; contexte</SectionHeading>
          <div className="mt-5 space-y-5">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motifs</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {PURPOSE_OPTIONS.map((opt) => {
                  const checked = selectedMotifs?.includes(opt.value)
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[3px] border px-4 py-3 transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMotif(opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
              {errors.motif && (
                <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                  ⚠️ {errors.motif.message}
                </p>
              )}
              {selectedMotifs?.includes("autre") && (
                <div className="mt-4">
                  <Field label="Précisez le motif" htmlFor="motifAutre">
                    <Input
                      id="motifAutre"
                      className={FIELD_INPUT}
                      {...register("motifAutre")}
                      placeholder="Autre motif..."
                    />
                  </Field>
                </div>
              )}
            </div>

            <Field label="Description détaillée" htmlFor="description">
              <Textarea
                id="description"
                className="rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"
                placeholder="Objectif de la mission, réunions prévues, etc."
                rows={4}
                {...register("description")}
              />
            </Field>
          </div>
        </section>

        {/* Voyage */}
        <section>
          <SectionHeading>Voyage</SectionHeading>
          <div className="mt-5 space-y-5">
            <Field label="Dates de déplacement">
              <DateRangePicker
                dateDepart={dateDepart}
                dateRetour={dateRetour}
                onDateDepartChange={(v) => setValue("dateDepart", v)}
                onDateRetourChange={(v) => setValue("dateRetour", v)}
                errorDepart={errors.dateDepart?.message}
                errorRetour={errors.dateRetour?.message}
              />
            </Field>

            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="destination"
                    className="text-sm font-medium"
                  >
                    Ville de destination
                  </Label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
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
                  <div className="mt-1.5">
                    <Input
                      id="destination"
                      placeholder="Indiquer la destination internationale..."
                      {...register("destination")}
                      className={cn(
                        FIELD_INPUT,
                        errors.destination?.message
                          ? "border-destructive"
                          : ""
                      )}
                    />
                    {errors.destination && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.destination.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-1.5">
                    <CityCombobox
                      id="destination"
                      label=""
                      value={destination}
                      onValueChange={(v) => setValue("destination", v ?? "")}
                      error={errors.destination?.message}
                      placeholder="Sélectionner la ville de destination..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Logistique */}
        <section>
          <SectionHeading>Logistique</SectionHeading>
          <div className="mt-5 space-y-5">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                Moyen de transport principal
              </Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(TRANSPORT_LABELS).map(([value, label]) => {
                  const active = typeTransport === value
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[3px] border px-4 py-3 transition-colors",
                        active
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-accent"
                      )}
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
                        className="size-4 appearance-none rounded-full border border-input checked:border-[5px] checked:border-primary"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {showVehicleField && vehicules.length > 0 && (
              <Field label="Véhicule de société" htmlFor="vehiculeId">
                <select
                  id="vehiculeId"
                  {...register("vehiculeId")}
                  className="h-9 w-full rounded-[3px] border border-border bg-background px-3 text-sm transition-[box-shadow] outline-none focus-visible:ring-1 focus-visible:ring-(--brand)"
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
              </Field>
            )}

            {typeTransport === "AUTRE" && (
              <Field label="Précisez le moyen de transport" htmlFor="autreTransport">
                <Input
                  id="autreTransport"
                  placeholder="Autre moyen..."
                  {...register("autreTransport")}
                  className={FIELD_INPUT}
                />
              </Field>
            )}
          </div>
        </section>

        {/* Budget & avance */}
        <section>
          <SectionHeading>Budget &amp; avance</SectionHeading>
          <div className="mt-5 space-y-5">
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field label="Frais Transport (Dhs)" htmlFor="fraisTransport">
                <Input
                  id="fraisTransport"
                  type="number"
                  min="0"
                  step="0.01"
                  className={FIELD_INPUT}
                  {...register("fraisTransport")}
                />
              </Field>
              <Field label="Hébergement (Dhs)" htmlFor="fraisHebergement">
                <Input
                  id="fraisHebergement"
                  type="number"
                  min="0"
                  step="0.01"
                  className={FIELD_INPUT}
                  {...register("fraisHebergement")}
                />
              </Field>
              <Field label="Repas (Dhs)" htmlFor="fraisRepas">
                <Input
                  id="fraisRepas"
                  type="number"
                  min="0"
                  step="0.01"
                  className={FIELD_INPUT}
                  {...register("fraisRepas")}
                />
              </Field>
              <Field label="Divers (Dhs)" htmlFor="fraisDivers">
                <Input
                  id="fraisDivers"
                  type="number"
                  min="0"
                  step="0.01"
                  className={FIELD_INPUT}
                  {...register("fraisDivers")}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-muted-foreground">
                Total estimé
              </span>
              <span className="text-base font-bold text-primary">
                {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                Dhs
              </span>
            </div>

            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={avanceRequise}
                  onCheckedChange={(checked: boolean) => {
                    setValue("avanceRequise", checked)
                    if (!checked) setValue("montantAvance", "")
                  }}
                />
                <span className="text-sm font-medium">
                  Demander une avance sur frais
                </span>
              </label>

              {avanceRequise && (
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field label="Montant de l'avance (Dhs)" htmlFor="montantAvance">
                    <Input
                      id="montantAvance"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register("montantAvance")}
                      className={FIELD_INPUT}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit((data) => onSave({ ...data, horsMaroc }))}
            disabled={saving || submitting}
            className="h-9 rounded-[3px]"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            <Save className="size-4" />
            Brouillon
          </Button>
          <Button
            type="button"
            onClick={handleSubmit((data) =>
              onSubmit({ ...data, horsMaroc })
            )}
            disabled={submitting || saving}
            className="h-9 rounded-[3px]"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            <Send className="size-4" />
            Soumettre
          </Button>
        </div>
      </form>
    </div>
  )
}
