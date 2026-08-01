import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import type { DemandeWithRelations } from "../demande-types"
import type { PdfRendererAdapter } from "../pdf-types"
import type { SocieteBranding } from "../societe"
import { generateDemandeDocumentPdf } from "./documents"

vi.mock("./mutations", () => ({
  recordDocument: vi.fn(),
}))

vi.mock("../pdf-mapper", () => ({
  toPdfRenderData: vi.fn(),
}))

const { recordDocument } = await import("./mutations")
const { toPdfRenderData } = await import("../pdf-mapper")

const demande = {
  id: "d-1",
  numero: "DD-2025-0001",
} as unknown as DemandeWithRelations

const branding: SocieteBranding = {
  id: "s-1",
  nom: "Acme SARL",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  couleurPrimaire: "#0055aa",
  nomExpediteurEmail: "Acme",
  domaineEmail: "acme.ma",
}

function fakeRenderer(
  buffer: Buffer = Buffer.from("%PDF-1.4")
): PdfRendererAdapter & { render: Mock } {
  return { render: vi.fn().mockResolvedValue(buffer) }
}

describe("generateDemandeDocumentPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps, renders, records, and returns the buffer", async () => {
    const renderer = fakeRenderer()
    const mapped = { numero: "DD-2025-0001" }
    ;(toPdfRenderData as Mock).mockReturnValue(mapped)

    const buffer = await generateDemandeDocumentPdf({
      demande,
      branding,
      renderer,
    })

    expect(toPdfRenderData).toHaveBeenCalledWith(demande, branding)
    expect(renderer.render).toHaveBeenCalledWith(mapped)
    expect(recordDocument).toHaveBeenCalledWith("d-1", {
      type: "PDF",
      chemin: "demande-DD-2025-0001.pdf",
    })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.toString()).toBe("%PDF-1.4")
  })

  it("threads null branding through to the mapper", async () => {
    const renderer = fakeRenderer()

    await generateDemandeDocumentPdf({ demande, branding: null, renderer })

    expect(toPdfRenderData).toHaveBeenCalledWith(demande, null)
  })

  it("does not record a document when rendering fails", async () => {
    const renderer = fakeRenderer()
    renderer.render.mockRejectedValue(new Error("render boom"))

    await expect(
      generateDemandeDocumentPdf({ demande, branding, renderer })
    ).rejects.toThrow("render boom")

    expect(recordDocument).not.toHaveBeenCalled()
  })

  it("does not record a document when mapping throws", async () => {
    const renderer = fakeRenderer()
    ;(toPdfRenderData as Mock).mockImplementation(() => {
      throw new Error("map boom")
    })

    await expect(
      generateDemandeDocumentPdf({ demande, branding, renderer })
    ).rejects.toThrow("map boom")

    expect(renderer.render).not.toHaveBeenCalled()
    expect(recordDocument).not.toHaveBeenCalled()
  })
})
