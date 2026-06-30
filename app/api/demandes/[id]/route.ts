import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { demandeService } from "@/lib/demande-service"
import { handleServiceError } from "@/lib/errors"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const demande = await demandeService.queries.findById(id)
    return NextResponse.json({ demande })
  } catch (e) {
    return handleServiceError(e)
  }
}
