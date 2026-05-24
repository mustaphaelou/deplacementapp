import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"
import { auditBus } from "@/lib/audit-bus"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const { telephone, poste, email, avatarData, currentPassword } = body
  const updateData: Record<string, string | null> = {}

  if (telephone !== undefined) {
    updateData.telephone = telephone || null
  }

  if (poste !== undefined) {
    updateData.poste = poste
  }

  if (email !== undefined) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Mot de passe requis pour modifier l'email" },
        { status: 400 }
      )
    }
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
    })
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }
    const isValid = await compare(currentPassword, user.motDePasse)
    if (!isValid) {
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 400 }
      )
    }
    updateData.email = email
  }

  if (avatarData !== undefined) {
    if (avatarData) {
      const matches = avatarData.match(/^data:(image\/\w+);base64,(.+)$/)
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
      const filename = `avatar-${session.user.id}-${Date.now()}.${ext}`
      const filepath = join(process.cwd(), "public", "uploads", "avatars", filename)
      await writeFile(filepath, buffer)

      const oldUser = await prisma.utilisateur.findUnique({
        where: { id: session.user.id },
        select: { avatarUrl: true },
      })
      if (oldUser?.avatarUrl) {
        const oldPath = join(process.cwd(), "public", oldUser.avatarUrl)
        try { await unlink(oldPath) } catch {}
      }

      updateData.avatarUrl = `/uploads/avatars/${filename}`
    } else {
      const oldUser = await prisma.utilisateur.findUnique({
        where: { id: session.user.id },
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

  const updated = await prisma.utilisateur.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, email: true, telephone: true, poste: true, avatarUrl: true },
  })

  await auditBus.log({
    utilisateurId: session.user.id,
    action: "MODIFICATION_PROFIL",
    entite: "Utilisateur",
    entiteId: updated.id,
    details: { champs: Object.keys(updateData) },
  })

  return NextResponse.json({ user: updated })
}
