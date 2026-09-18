import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/server"
import { listDepartements } from "@/lib/departement/queries"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const departements = await listDepartements()
    return NextResponse.json(departements)
  } catch (e) {
    return handleServiceError(e)
  }
}
