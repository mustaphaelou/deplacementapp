"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function useDemandeActions(demandeId: string, numero: string) {
  const router = useRouter()
  const [commentaire, setCommentaire] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)

  async function handleAction(action: string) {
    if (action === "rejeter" && !commentaire.trim()) {
      toast.error("Le commentaire est obligatoire pour le rejet")
      return
    }
    setActionLoading(action)

    try {
      const res = await fetch(`/api/demandes/${demandeId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, commentaire }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      const messages: Record<string, string> = {
        approuver: "Demande approuvée",
        rejeter: "Demande rejetée",
        retirer: "Demande retirée",
      }
      toast.success(messages[action] ?? "Action effectuée")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Erreur")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDownloadPdf() {
    try {
      const res = await fetch(`/api/demandes/${demandeId}/pdf`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `demande-${numero}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Erreur de génération PDF")
    }
  }

  return {
    commentaire,
    setCommentaire,
    actionLoading,
    showRejectForm,
    setShowRejectForm,
    handleAction,
    handleDownloadPdf,
  }
}
