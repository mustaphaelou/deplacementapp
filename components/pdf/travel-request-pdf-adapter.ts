import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { TravelRequestPdf } from "./travel-request-pdf"
import type { PdfRenderData } from "@/lib/pdf-types"
import type { PdfRendererAdapter } from "@/lib/pdf-renderer"

export class TravelRequestPdfAdapter implements PdfRendererAdapter {
  async render(data: PdfRenderData): Promise<Buffer> {
    const element = React.createElement(TravelRequestPdf as any, { data })
    return renderToBuffer(element as any)
  }
}
