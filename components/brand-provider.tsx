"use client"

import { useEffect } from "react"

export function BrandProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false
    fetch("/api/societe")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (
          !cancelled &&
          typeof data?.couleurPrimaire === "string" &&
          data.couleurPrimaire
        ) {
          document.documentElement.style.setProperty(
            "--brand",
            data.couleurPrimaire
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return children
}
