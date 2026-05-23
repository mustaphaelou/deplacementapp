import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import PdfDocument from "@/components/pdf-document"
import type { PdfRenderData } from "./pdf-types"

export interface PdfRendererAdapter {
  render(data: PdfRenderData): Promise<Buffer>
}

export class ReactPdfAdapter implements PdfRendererAdapter {
  async render(data: PdfRenderData): Promise<Buffer> {
    const element = React.createElement(PdfDocument as any, { data })
    return renderToBuffer(element as any)
  }
}

export class PdfRenderer {
  constructor(private adapter: PdfRendererAdapter) {}

  async render(data: PdfRenderData): Promise<Buffer> {
    return this.adapter.render(data)
  }
}

const defaultAdapter = new ReactPdfAdapter()
export const pdfRenderer = new PdfRenderer(defaultAdapter)
