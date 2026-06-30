import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  try {
    const departements = await prisma.departement.findMany({
      orderBy: { nom: "asc" },
    })
    return NextResponse.json(departements)
  } catch (e) {
    return handleServiceError(e)
  }
}
