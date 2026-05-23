import { describe, it, expect, vi } from "vitest"
import { PdfRenderer, ReactPdfAdapter, type PdfRendererAdapter } from "./pdf-renderer"
import type { PdfRenderData } from "./pdf-types"

function makePdfRenderData(overrides?: Partial<PdfRenderData>): PdfRenderData {
  return {
    numero: "DD-2025-0001",
    statut: "APPROUVEE_MANAGER",
    employeNom: "Dupont",
    employePrenom: "Jean",
    employePoste: "Développeur",
    employeDepartement: "IT",
    motif: ["Réunion client"],
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    destination: "Paris",
    typeTransport: "AVION",
    autreTransport: null,
    vehicule: null,
    couts: { transport: 100, hebergement: 200, repas: 50, divers: 30, total: 380 },
    avanceRequise: false,
    montantAvance: null,
    description: null,
    creeLe: new Date("2025-05-24"),
    assigneA: null,
    ...overrides,
  }
}

describe("PdfRenderer", () => {
  it("delegates render to its adapter and returns the adapter's buffer", async () => {
    const adapter: PdfRendererAdapter = {
      render: vi.fn().mockResolvedValue(Buffer.from("test-pdf-buffer")),
    }
    const renderer = new PdfRenderer(adapter)
    const data = makePdfRenderData()

    const result = await renderer.render(data)

    expect(adapter.render).toHaveBeenCalledTimes(1)
    expect(adapter.render).toHaveBeenCalledWith(data)
    expect(result).toEqual(Buffer.from("test-pdf-buffer"))
  })

  it("propagates adapter errors without wrapping", async () => {
    const adapter: PdfRendererAdapter = {
      render: vi.fn().mockRejectedValue(new Error("render failure")),
    }
    const renderer = new PdfRenderer(adapter)

    await expect(renderer.render(makePdfRenderData())).rejects.toThrow("render failure")
  })

  it("does not modify the PdfRenderData before passing to adapter", async () => {
    const adapter: PdfRendererAdapter = {
      render: vi.fn().mockResolvedValue(Buffer.from("ok")),
    }
    const renderer = new PdfRenderer(adapter)
    const data = makePdfRenderData({ numero: "DD-2025-9999" })

    await renderer.render(data)

    const passed = (adapter.render as ReturnType<typeof vi.fn>).mock.calls[0][0] as PdfRenderData
    expect(passed.numero).toBe("DD-2025-9999")
    expect(passed.statut).toBe("APPROUVEE_MANAGER")
  })
})

describe("ReactPdfAdapter", () => {
  it("renders a non-empty PDF buffer from PdfRenderData", async () => {
    const adapter = new ReactPdfAdapter()
    const buffer = await adapter.render(makePdfRenderData())

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it("handles vehicule and assigneA in the rendered PDF", async () => {
    const adapter = new ReactPdfAdapter()
    const buffer = await adapter.render(
      makePdfRenderData({
        vehicule: { nom: "Renault Clio", immatriculation: "XY-999-ZZ" },
        assigneA: { id: "u-2", nom: "Bernard", prenom: "Pierre" },
        description: "Test avec véhicule",
      })
    )

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
