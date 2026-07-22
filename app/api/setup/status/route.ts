import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  try {
    const userCount = await prisma.utilisateur.count()
    if (userCount > 0) {
      return NextResponse.json({ needsSetup: false })
    }

    const departements = await prisma.departement.findMany({
      orderBy: { nom: "asc" },
      select: { nom: true },
    })
    return NextResponse.json({
      needsSetup: true,
      departements: departements.map((d) => d.nom),
    })
  } catch (e) {
    return handleServiceError(e)
  }
}
