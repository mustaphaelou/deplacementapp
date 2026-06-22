"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Vehicule } from "@/lib/demande-types"
import type { DemandeFormValues } from "@/lib/schemas"

export function useDemandeForm() {
  const router = useRouter()
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/vehicules")
      .then((r) => r.json())
      .then(setVehicules)
      .catch(() => {})
  }, [])

  async function onSave(data: Partial<DemandeFormValues>) {
    setSaving(true)
    try {
      const res = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action: "save" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Brouillon sauvegardé")
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(data: Partial<DemandeFormValues>) {
    setSubmitting(true)
    try {
      const res = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action: "submit" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Demande soumise avec succès")
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Erreur lors de la soumission")
    } finally {
      setSubmitting(false)
    }
  }

  return { vehicules, saving, submitting, onSave, onSubmit }
}
