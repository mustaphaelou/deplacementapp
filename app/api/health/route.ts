import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "healthy" }, { status: 200 })
  } catch (error) {
    console.error("Healthcheck failed:", error)
    return NextResponse.json({ status: "unhealthy" }, { status: 503 })
  }
}
