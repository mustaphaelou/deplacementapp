import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/api-utils"
import { setupRegisterSchema } from "@/lib/schemas"
import { handleServiceError, AmorcageDejaConfigureError } from "@/lib/errors"
import { quitterAmorcage } from "@/lib/amorcage"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(setupRegisterSchema, body)
    if (!validation.ok) return validation.response

    const result = await quitterAmorcage({
      societe: {
        nom: validation.data.societeNom,
        nomExpediteurEmail: validation.data.nomExpediteurEmail,
        domaineEmail: validation.data.societeEmailDomain ?? "",
      },
      departements: validation.data.departements,
      admin: validation.data.admin,
    })

    return NextResponse.json({ user: result.user })
  } catch (e) {
    if (e instanceof AmorcageDejaConfigureError) {
      return NextResponse.json(
        { error: "Cette instance est déjà configurée" },
        { status: 409 }
      )
    }
    return handleServiceError(e)
  }
}
