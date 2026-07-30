"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { MOROCCAN_CITIES } from "@/lib/cities-morocco"

const POPULAR_CITIES = [
  "Casablanca",
  "Rabat",
  "Tanger",
  "Marrakech",
  "Agadir",
  "Fès",
]

const sortedCities = [...MOROCCAN_CITIES].sort((a, b) =>
  a.name.localeCompare(b.name, "fr")
)

interface CityComboboxProps {
  value?: string
  onValueChange?: (value: string | null) => void
  label?: string
  error?: string
  placeholder?: string
  id?: string
}

export function CityCombobox({
  value,
  onValueChange,
  label,
  error,
  placeholder = "Sélectionner la ville de destination...",
  id,
}: CityComboboxProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor={id}>{label}</Label>}

      {/* Popular cities quick-select chips */}
      <div className="mb-1 flex flex-wrap gap-1.5">
        {POPULAR_CITIES.map((cityName) => {
          const isActive = value === cityName
          return (
            <button
              key={cityName}
              type="button"
              onClick={() => onValueChange?.(isActive ? null : cityName)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 select-none",
                isActive
                  ? "border-primary bg-primary font-semibold text-primary-foreground shadow-xs"
                  : "border-zinc-200 bg-background text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              )}
            >
              {cityName}
            </button>
          )
        })}
      </div>

      <ComboboxPrimitive.Root
        value={value ?? null}
        onValueChange={(v) => onValueChange?.(v as string | null)}
        autoHighlight={false}
        openOnInputClick={true}
      >
        <div className="relative flex items-center">
          <ComboboxPrimitive.Trigger
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
              "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
              error && "border-destructive"
            )}
          >
            <div className="flex items-center gap-2 truncate pr-6">
              <Search className="size-3.5 shrink-0 opacity-50" />
              <ComboboxPrimitive.Value placeholder={placeholder} />
            </div>
            <ComboboxPrimitive.Icon>
              <ChevronDown className="size-4 opacity-50" />
            </ComboboxPrimitive.Icon>
          </ComboboxPrimitive.Trigger>
          {value && onValueChange && (
            <button
              type="button"
              onClick={() => onValueChange(null)}
              className="absolute right-9 flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner align="start" sideOffset={4}>
            <ComboboxPrimitive.Popup
              className={cn(
                "z-50 max-h-72 min-w-[var(--anchor-width)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md",
                "origin-[var(--anchor-transform-origin)] transition-[transform,scale,opacity]",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
              )}
            >
              <ComboboxPrimitive.Arrow className="fill-popover" />
              <div className="border-b p-2">
                <ComboboxPrimitive.Input
                  placeholder="Rechercher une ville..."
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <ComboboxPrimitive.List className="max-h-56 overflow-y-auto p-1">
                <ComboboxPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                  Aucune ville trouvée
                </ComboboxPrimitive.Empty>
                {sortedCities.map((city) => (
                  <ComboboxPrimitive.Item
                    key={city.name}
                    value={city.name}
                    className="group relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    <span className="absolute left-2 flex size-3.5 items-center justify-center">
                      <ComboboxPrimitive.ItemIndicator>
                        <Check className="size-4" />
                      </ComboboxPrimitive.ItemIndicator>
                    </span>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium">{city.name}</span>
                      <span className="truncate text-[10px] font-normal text-muted-foreground/75 group-data-[highlighted]:text-accent-foreground/75">
                        {city.region}
                      </span>
                    </span>
                  </ComboboxPrimitive.Item>
                ))}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
