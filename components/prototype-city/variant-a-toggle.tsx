"use client"

/**
 * Variant A — Toggle fallback
 * Combobox + "Hors Maroc" toggle that switches to free-text input.
 * PROTOTYPE — throwaway code, do not ship
 */

import { useState } from "react"
import { CityCombobox } from "@/components/ui/city-combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Globe } from "lucide-react"

interface VariantAProps {
  value?: string
  onValueChange?: (value: string | null) => void
  error?: string
  id?: string
}

export function VariantA({ value, onValueChange, error, id }: VariantAProps) {
  const [ horsMaroc, setHorsMaroc ] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Destination</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Globe className="size-3" />
          <span>Hors Maroc</span>
          <input
            type="checkbox"
            checked={horsMaroc}
            onChange={(e) => {
              setHorsMaroc(e.target.checked)
              if (e.target.checked) {
                onValueChange?.(null)
              }
            }}
            className="accent-primary size-3.5"
          />
        </label>
      </div>

      {horsMaroc ? (
        <Input
          id={id}
          placeholder="Saisissez la destination..."
          value={value ?? ""}
          onChange={(e) => onValueChange?.(e.target.value)}
          className={error ? "border-destructive" : ""}
        />
      ) : (
        <CityCombobox
          id={id}
          label=""
          value={value}
          onValueChange={onValueChange}
          error={error}
          placeholder="Rechercher une ville..."
        />
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
