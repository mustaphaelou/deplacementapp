import { describe, it, expect } from "vitest"
import { TravelRequestPdfAdapter } from "./travel-request-pdf-adapter"
import type { PdfRenderData } from "@/lib/pdf-types"
import { toDemandeDocumentView } from "@/lib/demande-presentation"
import {
  MOTIF_CANONICAL_LABEL,
  MOTIF_CANONICAL_SLUG,
  MOTIF_FREE_TEXT,
  MOTIF_LABELS_EXPECTED,
  STORED_MOTIF_JSON,
} from "@/lib/test/demande-motif-fixtures"

function makePdfRenderData(overrides?: Partial<PdfRenderData>): PdfRenderData {
  return {
    numero: "DD-2025-0001",
    etape: "MANAGER_REVIEW",
    decision: "APPROVED",
    employeNom: "Dupont",
    employePrenom: "Jean",
    employePoste: "Développeur",
    employeDepartement: "IT",
    motifsLabels: [...MOTIF_LABELS_EXPECTED],
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    destination: "Casablanca",
    typeTransport: "AVION",
    autreTransport: null,
    vehicule: null,
    couts: {
      transport: 100,
      hebergement: 200,
      repas: 50,
      divers: 30,
      total: 380,
    },
    avanceRequise: false,
    montantAvance: null,
    description: null,
    creeLe: new Date("2025-05-24"),
    assigneA: null,
    branding: null,
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
    const buffer = await adapter.render(makePdfRenderData({ etape: "DRAFT" }))

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  // The renderer's own job is to print what it is handed. The fixture is
  // therefore seeded from the shared Motif fixtures at the shape the document
  // projection produces — French labels, no stored slug — so the adapter
  // cannot be handed a shape the mapper never emits, and so a slug here would
  // be a visible failure rather than a silent pass.
  it("is seeded with the labels the document projection produces", () => {
    const view = toDemandeDocumentView({
      motif: STORED_MOTIF_JSON,
      typeTransport: "AVION",
      etape: "MANAGER_REVIEW",
      decision: "APPROVED",
    })

    expect(makePdfRenderData().motifsLabels).toEqual(view.motifs)
    expect(makePdfRenderData().motifsLabels).toEqual([
      MOTIF_CANONICAL_LABEL,
      MOTIF_FREE_TEXT,
    ])
  })

  it("is never handed a stored Motif slug", () => {
    expect(makePdfRenderData().motifsLabels).not.toContain(MOTIF_CANONICAL_SLUG)
  })
})
