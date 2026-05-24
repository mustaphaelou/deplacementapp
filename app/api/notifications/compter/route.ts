import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const count = await prisma.notification.count({
    where: { utilisateurId: auth.user.id, lu: false },
  })

  return NextResponse.json({ count })
}
