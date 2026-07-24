import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { handleServiceError } from "@/lib/errors"
import { auditBus } from "@/lib/audit-bus"

export async function GET() {
  try {
    const societe = await prisma.societe.findFirst()
    if (!societe) {
      return NextResponse.json({ error: "Aucune société configurée" }, { status: 404 })
    }
    return NextResponse.json(societe)
  } catch (e) {
    return handleServiceError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth()
    if (!session.ok) {
      return session.response
    }

    const societe = await prisma.societe.findFirst()
    if (!societe) {
      return NextResponse.json({ error: "Aucune société configurée" }, { status: 404 })
    }

    const body = await req.json()
    const allowed = ["nom", "logoUrl", "faviconUrl", "couleurPrimaire", "nomExpediteurEmail", "domaineEmail"]

    const changes: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        changes[key] = body[key]
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 })
    }

    const updated = await prisma.societe.update({
      where: { id: societe.id },
      data: changes,
    })

    await auditBus.log({
      utilisateurId: session.user.id,
      action: "MODIFIER_SOCIETE",
      entite: "Societe",
      entiteId: societe.id,
      details: { changes: Object.keys(changes) },
    })

    return NextResponse.json(updated)
  } catch (e) {
    return handleServiceError(e)
  }
}