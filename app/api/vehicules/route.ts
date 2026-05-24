import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { vehiculeService } from "@/lib/vehicule-service"
import { vehiculeSchema, updateVehiculeSchema, deleteVehiculeSchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const vehicules = await vehiculeService.list()

  return NextResponse.json(vehicules)
}

export const POST = withValidation(vehiculeSchema, async (_req, auth, data) => {
  if (auth.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const vehicule = await vehiculeService.create(data, auth.id)

  return NextResponse.json({ vehicule })
})

export const PUT = withValidation(updateVehiculeSchema, async (_req, auth, data) => {
  if (auth.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const { id, ...updateData } = data
  const vehicule = await vehiculeService.update(id, updateData, auth.id)

  return NextResponse.json({ vehicule })
})

export const DELETE = withValidation(deleteVehiculeSchema, async (_req, auth, data) => {
  if (auth.role !== "FINANCE_ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  await vehiculeService.delete(data.id, auth.id)

  return NextResponse.json({ success: true })
})
