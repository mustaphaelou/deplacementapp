import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { toPdfRenderData } from "@/lib/pdf-mapper"
import { pdfAdapter } from "@/components/pdf/travel-request-pdf-adapter"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const demande = await prisma.demandeDeplacement.findUnique({
    where: { id },
    include: {
      employe: true,
      vehicule: true,
      assigneA: true,
    },
  })

  if (!demande) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

  try {
    const data = toPdfRenderData(demande)
    const buffer = await pdfAdapter.render(data)

    await prisma.document.create({
      data: {
        demandeId: id,
        type: "PDF",
        chemin: `demande-${demande.numero}.pdf`,
      },
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="demande-${demande.numero}.pdf"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: "Erreur de génération PDF" }, { status: 500 })
  }
}
