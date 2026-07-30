import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { handleServiceError } from "@/lib/errors"
import { getSocieteBranding, updateSociete } from "@/lib/societe"

export async function GET() {
  try {
    const branding = await getSocieteBranding()
    if (!branding) {
      return NextResponse.json({ error: "Aucune société configurée" }, { status: 404 })
    }
    return NextResponse.json(branding)
  } catch (e) {
    return handleServiceError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth()
    if (!session.ok) {
      return session.response
    }

    const body = await req.json()
    const changes = await updateSociete(body, session.user.id)

    return NextResponse.json(changes)
  } catch (e) {
    return handleServiceError(e)
  }
}
