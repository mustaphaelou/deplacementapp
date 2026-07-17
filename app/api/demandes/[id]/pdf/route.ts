import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { demandeService } from "@/lib/demande-service"
import { toPdfRenderData } from "@/lib/pdf-mapper"
import { pdfAdapter } from "@/components/pdf/travel-request-pdf-adapter"
import { handleServiceError } from "@/lib/errors"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const demande = await demandeService.queries.findById(id)
    const data = toPdfRenderData(demande)
    const buffer = await pdfAdapter.render(data)

    await demandeService.recordDocument(id, {
      type: "PDF",
      chemin: `demande-${demande.numero}.pdf`,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="demande-${demande.numero}.pdf"`,
      },
    })
  } catch (e) {
    return handleServiceError(e)
  }
}
