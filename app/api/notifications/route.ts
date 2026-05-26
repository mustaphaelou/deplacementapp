import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const notifications = await prisma.notification.findMany({
    where: { utilisateurId: auth.user.id },
    orderBy: { creeLe: "desc" },
    take: 50,
  })

  return NextResponse.json({ notifications })
}
