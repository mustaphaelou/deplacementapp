import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toPdfRenderData } from "@/lib/pdf-mapper"
import { pdfRenderer } from "@/lib/pdf-renderer"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

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
    const buffer = await pdfRenderer.render(data)

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
