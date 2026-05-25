"use client"

/**
 * Variant C — Quick select grid + compact search
 * Popular cities as clickable cards + compact searchable list. Mobile-friendly.
 * PROTOTYPE — throwaway code, do not ship
 */

import { useState, useMemo, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Search, X, MapPin } from "lucide-react"
import { MOROCCAN_CITIES } from "@/lib/cities-morocco"

interface VariantCProps {
  value?: string
  onValueChange?: (value: string | null) => void
  error?: string
  id?: string
}

const POPULAR_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger",
  "Agadir", "Meknès", "Oujda", "El Jadida", "Kénitra",
]

export function VariantC({ value, onValueChange, error, id }: VariantCProps) {
  const [ query, setQuery ] = useState("")
  const [ showFullList, setShowFullList ] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showFullList && inputRef.current) {
      inputRef.current.focus()
    }
  }, [ showFullList ])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return MOROCCAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
    ).slice(0, 30)
  }, [ query ])

  function select(city: string) {
    onValueChange?.(city)
    setQuery("")
    setShowFullList(false)
  }

  if (showFullList) {
    return (
      <div className="space-y-2">
        <Label>Destination</Label>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            placeholder="Rechercher une ville..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border p-1">
          {results.length === 0 && query.trim() ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune ville trouvée
            </p>
          ) : query.trim() ? (
            results.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => select(city.name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left",
                  value === city.name && "bg-accent"
                )}
              >
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{city.name}</span>
                  <span className="text-xs text-muted-foreground">{city.region}</span>
                </div>
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Commencez à taper pour chercher...
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowFullList(false)
            setQuery("")
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Retour aux villes populaires
        </button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Destination</Label>
        {value && onValueChange && (
          <button
            type="button"
            onClick={() => onValueChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="size-3" />
            Effacer
          </button>
        )}
      </div>

      {value ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <MapPin className="size-4 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">{value}</span>
            <span className="text-xs text-muted-foreground">
              {MOROCCAN_CITIES.find((c) => c.name === value)?.region}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => select(city)}
                className={cn(
                  "flex items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-center",
                  value === city && "border-primary bg-primary/10 text-primary"
                )}
              >
                {city}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowFullList(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Search className="size-4" />
            Rechercher toutes les villes...
          </button>
        </>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
