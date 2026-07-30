import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: "healthy" }, { status: 200 })
  } catch (error) {
    console.error("Healthcheck failed:", error)
    return NextResponse.json({ status: "unhealthy" }, { status: 503 })
  }
}
