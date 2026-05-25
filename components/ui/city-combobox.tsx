"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { MOROCCAN_CITIES, REGIONS, getCityRegion } from "@/lib/cities-morocco"

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
  placeholder = "Rechercher une ville...",
  id,
}: CityComboboxProps) {
  const selectedRegion = value ? getCityRegion(value) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <ComboboxPrimitive.Root
        value={value ?? null}
        onValueChange={(v) => onValueChange?.(v as string | null)}
        autoHighlight={false}
        openOnInputClick={true}
      >
        <ComboboxPrimitive.Trigger
          className={cn(
            "border-input flex h-8 w-full items-center justify-between rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center gap-2 truncate">
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
            className="text-muted-foreground hover:text-foreground -ml-6 mr-7 mt-[-1.75rem] flex size-4 items-center justify-center self-end"
            tabIndex={-1}
          >
            <X className="size-3" />
          </button>
        )}
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner align="start" sideOffset={4}>
            <ComboboxPrimitive.Popup
              className={cn(
                "bg-popover text-popover-foreground z-50 min-w-[var(--anchor-width)] max-h-72 overflow-hidden rounded-lg border shadow-md",
                "origin-[var(--anchor-transform-origin)] transition-[transform,scale,opacity]",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
              )}
            >
              <ComboboxPrimitive.Arrow className="fill-popover" />
              <div className="border-b p-2">
                <ComboboxPrimitive.Input
                  placeholder="Rechercher une ville..."
                  className="border-input flex h-8 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <ComboboxPrimitive.List className="max-h-56 overflow-y-auto p-1">
                <ComboboxPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                  Aucune ville trouvée
                </ComboboxPrimitive.Empty>
                {REGIONS.map((region) => {
                  const cities = MOROCCAN_CITIES.filter((c) => c.region === region)
                  if (cities.length === 0) return null
                  return (
                    <ComboboxPrimitive.Group key={region}>
                      <ComboboxPrimitive.GroupLabel className="text-muted-foreground px-2 py-1.5 text-xs font-semibold uppercase tracking-wider">
                        {region}
                      </ComboboxPrimitive.GroupLabel>
                      {cities.map((city) => (
                        <ComboboxPrimitive.Item
                          key={city.name}
                          value={city.name}
                          className="relative flex w-full cursor-default items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          <span className="absolute left-2 flex size-3.5 items-center justify-center">
                            <ComboboxPrimitive.ItemIndicator>
                              <Check className="size-4" />
                            </ComboboxPrimitive.ItemIndicator>
                          </span>
                          <span>{city.name}</span>
                        </ComboboxPrimitive.Item>
                      ))}
                    </ComboboxPrimitive.Group>
                  )
                })}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
