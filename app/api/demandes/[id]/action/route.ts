import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
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
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

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
      actor: { id: session.user.id, role: session.user.role as Role },
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
