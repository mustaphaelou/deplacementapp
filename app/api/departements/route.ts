import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const departements = await prisma.departement.findMany({
    orderBy: { nom: "asc" },
  })
  return NextResponse.json(departements)
}
