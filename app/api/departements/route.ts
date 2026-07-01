import { NextResponse } from "next/server"
import { departementQueries } from "@/lib/departement-queries"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  try {
    const departements = await departementQueries.findAll()
    return NextResponse.json(departements)
  } catch (e) {
    return handleServiceError(e)
  }
}
