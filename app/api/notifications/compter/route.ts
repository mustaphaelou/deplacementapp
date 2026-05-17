import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const count = await prisma.notification.count({
    where: { utilisateurId: session.user.id, lu: false },
  })

  return NextResponse.json({ count })
}
