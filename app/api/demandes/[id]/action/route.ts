import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { demandeService } from "@/lib/demande-service"
import {
  UnauthorizedActionError,
  DemandeNotFoundError,
  InvalidTransitionError,
} from "@/lib/demande-service"
import type { Role } from "@prisma/client"

const REQUIRED_COMMENT_ACTIONS = ["rejeter"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = body.action as "approuver" | "rejeter" | "retirer"

  if (!action || !["approuver", "rejeter", "retirer"].includes(action)) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 })
  }

  if (REQUIRED_COMMENT_ACTIONS.includes(action)) {
    const commentaire = body.commentaire?.trim()
    if (!commentaire) {
      return NextResponse.json({ error: "Le commentaire est obligatoire pour le rejet" }, { status: 400 })
    }
  }

  const comment = action === "approuver" ? body.commentaire?.trim() : undefined

  try {
    const result = await demandeService.executeAction({
      action,
      demandeId: id,
      actor: { id: auth.user.id, role: auth.user.role as Role },
      comment,
    })
    return NextResponse.json({ demande: result.demande })
  } catch (e) {
    if (e instanceof DemandeNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof UnauthorizedActionError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof InvalidTransitionError) return NextResponse.json({ error: e.message }, { status: 422 })
    throw e
  }
}
