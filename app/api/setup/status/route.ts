import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  try {
    const societeCount = await prisma.societe.count()
    if (societeCount > 0) {
      return NextResponse.json({ needsSetup: false })
    }

    return NextResponse.json({
      needsSetup: true,
      departements: [],
    })
  } catch (e) {
    return handleServiceError(e)
  }
}