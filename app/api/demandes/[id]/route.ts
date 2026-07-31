import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type Role } from "@/lib/auth/server"
import { findById } from "@/lib/demande"
import { handleServiceError } from "@/lib/errors"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const demande = await findById(id, {
      id: auth.user.id,
      role: auth.user.role as Role,
    })
    return NextResponse.json({ demande })
  } catch (e) {
    return handleServiceError(e)
  }
}
