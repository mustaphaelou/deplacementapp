import { NextResponse } from "next/server"
import { handleServiceError } from "@/lib/errors"
import { estEnAmorcage } from "@/lib/amorcage"

export async function GET() {
  try {
    const needsSetup = await estEnAmorcage()

    if (!needsSetup) {
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
