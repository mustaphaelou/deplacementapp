import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { utilisateurService } from "@/lib/utilisateur-service"
import { profilUpdateSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { avatarStorage, AvatarError } from "@/lib/avatar-storage"

export const PUT = withValidation(profilUpdateSchema, async (_req, auth, data) => {
  const updateData: Record<string, string | null> = {}

  if (data.telephone !== undefined) {
    updateData.telephone = data.telephone || null
  }

  if (data.poste !== undefined) {
    updateData.poste = data.poste
  }

  if (data.email !== undefined) {
    if (!data.currentPassword) {
      return NextResponse.json(
        { error: "Mot de passe requis pour modifier l'email" },
        { status: 400 }
      )
    }
    const user = await prisma.utilisateur.findUnique({
      where: { id: auth.id },
    })
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }
    const isValid = await compare(data.currentPassword, user.motDePasse)
    if (!isValid) {
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 400 }
      )
    }
    updateData.email = data.email
  }

  if (data.avatarData !== undefined) {
    try {
      const oldUser = await prisma.utilisateur.findUnique({
        where: { id: auth.id },
        select: { avatarUrl: true },
      })
      if (oldUser?.avatarUrl) {
        await avatarStorage.delete(oldUser.avatarUrl)
      }
      updateData.avatarUrl = data.avatarData
        ? await avatarStorage.save(data.avatarData, auth.id)
        : null
    } catch (e) {
      if (e instanceof AvatarError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      throw e
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 })
  }

  const updated = await utilisateurService.updateProfile(auth.id, updateData)

  return NextResponse.json({ user: updated })
})
