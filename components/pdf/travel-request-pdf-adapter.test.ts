import { describe, it, expect } from "vitest"
import { TravelRequestPdfAdapter } from "./travel-request-pdf-adapter"
import type { PdfRenderData } from "@/lib/pdf-types"

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
    destination: "Casablanca",
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

describe("TravelRequestPdfAdapter", () => {
  it("renders a non-empty PDF buffer from PdfRenderData", async () => {
    const adapter = new TravelRequestPdfAdapter()
    const buffer = await adapter.render(makePdfRenderData())

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it("renders PDF with vehicule and assigneA fields", async () => {
    const adapter = new TravelRequestPdfAdapter()
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

  it("renders PDF with BROUILLON status (watermark path)", async () => {
    const adapter = new TravelRequestPdfAdapter()
    const buffer = await adapter.render(makePdfRenderData({ statut: "BROUILLON" }))

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
