import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db } from "@/db"
import { countUnread } from "@/lib/notification/queries"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const count = await countUnread(auth.user.id, db)
    return NextResponse.json({ count })
  } catch (e) {
    return handleServiceError(e)
  }
}
