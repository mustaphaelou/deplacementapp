"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { toast } from "sonner"

interface ProfileUser {
  email: string
  telephone: string | null
  poste: string
  avatarUrl: string | null
}

export function useProfileForm(user: ProfileUser) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [telephone, setTelephone] = useState(user.telephone ?? "")
  const [poste, setPoste] = useState(user.poste)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<string | null>(null)

  const avatarSrc = avatarPreview || user.avatarUrl

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      toast.error("Formats acceptés : JPG, PNG, WebP")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
      setAvatarFile(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveAvatar() {
    setAvatarPreview(null)
    setAvatarFile("")
  }

  function cancelEdit() {
    setEditing(false)
    setTelephone(user.telephone ?? "")
    setPoste(user.poste)
    setEmail(user.email)
    setCurrentPassword("")
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { telephone, poste }
      let needsRelogin = false

      if (email !== user.email) {
        if (!currentPassword) {
          toast.error("Mot de passe requis pour modifier l'email")
          setSaving(false)
          return
        }
        body.email = email
        body.currentPassword = currentPassword
        needsRelogin = true
      }

      if (avatarFile === "") {
        body.avatarData = null
      } else if (avatarFile) {
        body.avatarData = avatarFile
      }

      const res = await fetch("/api/utilisateurs/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erreur")
        return
      }

      toast.success("Profil mis à jour")
      setEditing(false)
      setCurrentPassword("")

      if (needsRelogin) {
        toast.success("Email modifié — veuillez vous reconnecter")
        await signOut({ redirectTo: "/login" })
      } else {
        router.refresh()
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    setEditing,
    saving,
    telephone,
    setTelephone,
    poste,
    setPoste,
    email,
    setEmail,
    currentPassword,
    setCurrentPassword,
    avatarPreview,
    avatarFile,
    avatarSrc,
    handleAvatarSelect,
    handleRemoveAvatar,
    cancelEdit,
    handleSave,
  }
}
