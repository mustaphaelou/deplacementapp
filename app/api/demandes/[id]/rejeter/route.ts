import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { demandeService } from "@/lib/demande-service"
import {
  UnauthorizedActionError,
  DemandeNotFoundError,
  InvalidTransitionError,
} from "@/lib/demande-service"
import type { Role } from "@prisma/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorise" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const commentaire = body.commentaire?.trim()

  if (!commentaire) {
    return NextResponse.json({ error: "Le commentaire est obligatoire pour le rejet" }, { status: 400 })
  }

  try {
    const result = await demandeService.executeAction({
      action: "rejeter",
      demandeId: id,
      actor: { id: session.user.id, role: session.user.role as Role },
      comment: commentaire,
    })
    return NextResponse.json({ demande: result.demande })
  } catch (e) {
    if (e instanceof DemandeNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof UnauthorizedActionError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof InvalidTransitionError) return NextResponse.json({ error: e.message }, { status: 422 })
    throw e
  }
}
