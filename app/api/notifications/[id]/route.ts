import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { markAsRead } from "@/lib/notification"
import { handleServiceError } from "@/lib/errors"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    await markAsRead(id, auth.user.id)
  } catch (e) {
    return handleServiceError(e)
  }

  return NextResponse.json({ ok: true })
}
