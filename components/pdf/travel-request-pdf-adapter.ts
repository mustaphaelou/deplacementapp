import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { TravelRequestPdf } from "./travel-request-pdf"
import type { PdfRenderData, PdfRendererAdapter } from "@/lib/pdf-types"

export class TravelRequestPdfAdapter implements PdfRendererAdapter {
  async render(data: PdfRenderData): Promise<Buffer> {
    const element = React.createElement(TravelRequestPdf as any, { data })
    return renderToBuffer(element as any)
  }
}

export const pdfAdapter = new TravelRequestPdfAdapter()
