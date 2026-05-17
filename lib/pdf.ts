import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import PdfDocument from "@/components/pdf-document"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise } from "@prisma/client"

type DemandeWithRelations = DemandeDeplacement & {
  employe: Utilisateur
  vehicule: VehiculeEntreprise | null
}

export async function generatePdfBuffer(demande: DemandeWithRelations): Promise<Buffer> {
  const element = React.createElement(PdfDocument as any, { demande })
  return renderToBuffer(element as any)
}
