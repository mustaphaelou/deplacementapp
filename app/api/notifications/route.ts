import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { notificationQueries } from "@/lib/notification-queries"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const notifications = await notificationQueries.listForUser(auth.user.id)
    return NextResponse.json({ notifications })
  } catch (e) {
    return handleServiceError(e)
  }
}
