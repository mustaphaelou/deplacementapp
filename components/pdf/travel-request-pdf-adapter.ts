import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { TravelRequestPdf } from "./travel-request-pdf"
import type { PdfRenderData, PdfRendererAdapter } from "@/lib/pdf-types"
import { PdfRenderError } from "@/lib/errors"

export class TravelRequestPdfAdapter implements PdfRendererAdapter {
  async render(data: PdfRenderData): Promise<Buffer> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(TravelRequestPdf as any, { data })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return renderToBuffer(element as any)
    } catch (e) {
      console.error("PDF render failed:", e)
      throw new PdfRenderError()
    }
  }
}

export const pdfAdapter = new TravelRequestPdfAdapter()
