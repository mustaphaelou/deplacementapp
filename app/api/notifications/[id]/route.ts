import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { utilisateurId: true },
  })

  if (!notification) {
    return NextResponse.json({ error: "Notification introuvable" }, { status: 404 })
  }

  if (notification.utilisateurId !== auth.user.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  await prisma.notification.update({
    where: { id },
    data: { lu: true },
  })

  return NextResponse.json({ ok: true })
}
