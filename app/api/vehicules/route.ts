import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole } from "@/lib/auth/server"
import { ROLES_MANAGEMENT } from "@/lib/auth/roles"
import { vehiculeService } from "@/lib/vehicule-service"
import {
  vehiculeSchema,
  updateVehiculeSchema,
  deleteVehiculeSchema,
} from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

// The fleet READ is deliberately unguarded beyond the session: the
// DemandeDeplacement creation form reads it to populate its VehiculeEntreprise
// picker, so every signed-in Utilisateur must reach it. Only the writes below
// are reserved to the declared set (ROLES_MANAGEMENT, spec #281).
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const vehicules = await vehiculeService.list()
    return NextResponse.json(vehicules)
  } catch (e) {
    return handleServiceError(e)
  }
}

export const POST = withValidation(vehiculeSchema, async (_req, auth, data) => {
  const authorized = requireAnyRole(auth, ROLES_MANAGEMENT)
  if (!authorized.ok) return authorized.response

  try {
    const vehicule = await vehiculeService.create(data, auth.id)
    return NextResponse.json({ vehicule })
  } catch (e) {
    return handleServiceError(e)
  }
})

export const PUT = withValidation(
  updateVehiculeSchema,
  async (_req, auth, data) => {
    const authorized = requireAnyRole(auth, ROLES_MANAGEMENT)
    if (!authorized.ok) return authorized.response

    const { id, ...updateData } = data
    try {
      const vehicule = await vehiculeService.update(id, updateData, auth.id)
      return NextResponse.json({ vehicule })
    } catch (e) {
      return handleServiceError(e)
    }
  }
)

export const DELETE = withValidation(
  deleteVehiculeSchema,
  async (_req, auth, data) => {
    const authorized = requireAnyRole(auth, ROLES_MANAGEMENT)
    if (!authorized.ok) return authorized.response

    try {
      await vehiculeService.delete(data.id, auth.id)
      return NextResponse.json({ success: true })
    } catch (e) {
      return handleServiceError(e)
    }
  }
)
