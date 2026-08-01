import { NextRequest, NextResponse } from "next/server"
import { requireAuth, type Role } from "@/lib/auth/server"
import { findById } from "@/lib/demande"
import { generateDemandeDocumentPdf } from "@/lib/demande/documents"
import { getSocieteBranding } from "@/lib/societe"
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
    const demande = await findById(id, {
      id: auth.user.id,
      role: auth.user.role as Role,
    })
    const branding = await getSocieteBranding()
    const buffer = await generateDemandeDocumentPdf({
      demande,
      branding,
      renderer: pdfAdapter,
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
