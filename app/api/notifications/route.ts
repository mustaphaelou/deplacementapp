import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { db } from "@/db"
import { listForUser } from "@/lib/notification/queries"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const notifications = await listForUser(auth.user.id, db)
    return NextResponse.json({ notifications })
  } catch (e) {
    return handleServiceError(e)
  }
}
