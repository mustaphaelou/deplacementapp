import type { DemandeWithRelations } from "../demande-types"
import type { PdfRendererAdapter } from "../pdf-types"
import { toPdfRenderData } from "../pdf-mapper"
import type { SocieteBranding } from "../societe"
import { recordDocument } from "./mutations"

export interface GenerateDemandeDocumentPdfParams {
  demande: DemandeWithRelations
  branding: SocieteBranding | null
  renderer: PdfRendererAdapter
}

export async function generateDemandeDocumentPdf({
  demande,
  branding,
  renderer,
}: GenerateDemandeDocumentPdfParams): Promise<Buffer> {
  const data = toPdfRenderData(demande, branding)
  const buffer = await renderer.render(data)

  await recordDocument(demande.id, {
    type: "PDF",
    chemin: `demande-${demande.numero}.pdf`,
  })

  return buffer
}
