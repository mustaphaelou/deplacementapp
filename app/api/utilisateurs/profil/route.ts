import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { utilisateurService } from "@/lib/utilisateur-service"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { profilUpdateSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024

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
    if (data.avatarData) {
      const matches = data.avatarData.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.json(
          { error: "Format d'image invalide" },
          { status: 400 }
        )
      }
      const mime = matches[1]
      const base64 = matches[2]
      if (!ALLOWED_TYPES.includes(mime)) {
        return NextResponse.json(
          { error: "Type d'image non autorisé (JPG, PNG, WebP uniquement)" },
          { status: 400 }
        )
      }
      const buffer = Buffer.from(base64, "base64")
      if (buffer.length > MAX_SIZE) {
        return NextResponse.json(
          { error: "L'image ne doit pas dépasser 2 Mo" },
          { status: 400 }
        )
      }
      const ext = mime.split("/")[1]
      const filename = `avatar-${auth.id}-${Date.now()}.${ext}`
      const filepath = join(process.cwd(), "public", "uploads", "avatars", filename)
      await writeFile(filepath, buffer)

      const oldUser = await prisma.utilisateur.findUnique({
        where: { id: auth.id },
        select: { avatarUrl: true },
      })
      if (oldUser?.avatarUrl) {
        const oldPath = join(process.cwd(), "public", oldUser.avatarUrl)
        try { await unlink(oldPath) } catch {}
      }

      updateData.avatarUrl = `/uploads/avatars/${filename}`
    } else {
      const oldUser = await prisma.utilisateur.findUnique({
        where: { id: auth.id },
        select: { avatarUrl: true },
      })
      if (oldUser?.avatarUrl) {
        const oldPath = join(process.cwd(), "public", oldUser.avatarUrl)
        try { await unlink(oldPath) } catch {}
      }
      updateData.avatarUrl = null
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 })
  }

  const updated = await utilisateurService.updateProfile(auth.id, updateData)

  return NextResponse.json({ user: updated })
})
