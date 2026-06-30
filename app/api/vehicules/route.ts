import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { requireRole } from "@/lib/authorization"
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
  const authorized = requireRole(auth, "FINANCE_ADMIN")
  if (!authorized.ok) return authorized.response

  const vehicule = await vehiculeService.create(data, auth.id)

  return NextResponse.json({ vehicule })
})

export const PUT = withValidation(updateVehiculeSchema, async (_req, auth, data) => {
  const authorized = requireRole(auth, "FINANCE_ADMIN")
  if (!authorized.ok) return authorized.response

  const { id, ...updateData } = data
  const vehicule = await vehiculeService.update(id, updateData, auth.id)

  return NextResponse.json({ vehicule })
})

export const DELETE = withValidation(deleteVehiculeSchema, async (_req, auth, data) => {
  const authorized = requireRole(auth, "FINANCE_ADMIN")
  if (!authorized.ok) return authorized.response

  await vehiculeService.delete(data.id, auth.id)

  return NextResponse.json({ success: true })
})
