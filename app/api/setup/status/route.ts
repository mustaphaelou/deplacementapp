import { NextResponse } from "next/server"
import { count } from "drizzle-orm"
import { db } from "@/db"
import { societes } from "@/db/schema/societes"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  try {
    const [result] = await db.select({ value: count() }).from(societes)
    if ((result?.value ?? 0) > 0) {
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