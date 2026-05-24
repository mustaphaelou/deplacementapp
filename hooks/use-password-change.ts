"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"

export function usePasswordChange() {
  const [savingPassword, setSavingPassword] = useState(false)
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Tous les champs sont requis")
      return
    }
    if (pwNew.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères")
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("/api/utilisateurs/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur")
        return
      }

      toast.success("Mot de passe modifié — veuillez vous reconnecter")
      await signOut({ redirectTo: "/login" })
    } catch {
      toast.error("Erreur")
    } finally {
      setSavingPassword(false)
    }
  }

  return {
    savingPassword,
    pwCurrent,
    setPwCurrent,
    pwNew,
    setPwNew,
    pwConfirm,
    setPwConfirm,
    showPwCurrent,
    setShowPwCurrent,
    showPwNew,
    setShowPwNew,
    showPwConfirm,
    setShowPwConfirm,
    handleChangePassword,
  }
}
