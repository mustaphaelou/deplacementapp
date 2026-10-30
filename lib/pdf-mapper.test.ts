import { expect, describe, it } from "vitest"
import { type DemandeWithRelations } from "./demande-types"
import { MOTIF_LABELS } from "./demande-presentation"
import { toPdfRenderData } from "./pdf-mapper"
import {
  MOTIF_CANONICAL_LABEL,
  MOTIF_CANONICAL_SLUG,
  MOTIF_FREE_TEXT,
  MOTIF_LABELS_EXPECTED,
  STORED_MOTIF_JSON,
} from "./test/demande-motif-fixtures"

function makeDemande(
  overrides?: Record<string, unknown>
): DemandeWithRelations {
  return {
    id: "d-1",
    numero: "DD-2025-0001",
    employeId: "u-1",
    assigneAId: null,

    etape: "FINANCE_REVIEW",
    decision: "PENDING",
    employeNom: "Dupont",
    employePrenom: "Jean",
    employePoste: "Développeur",
    employeDepartement: "IT",
    motif: STORED_MOTIF_JSON,
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    destination: "Casablanca",
    typeTransport: "AVION",
    autreTransport: null,
    vehiculeId: null,
    fraisTransport: 100,
    fraisHebergement: 200,
    fraisRepas: 50,
    fraisDivers: 30,
    totalEstime: 380,
    avanceRequise: false,
    montantAvance: null,
    description: null,
    commentaireManager: null,
    commentaireFinance: null,
    commentaireDirection: null,
    soumiseLe: null,
    approuveeManagerLe: null,
    approuveeFinanceLe: null,
    approuveeDirectionLe: null,
    rejeteeLe: null,
    retireeLe: null,
    deletedAt: null,
    creeLe: new Date("2025-05-24"),
    modifieLe: new Date("2025-05-24"),
    employe: {
      id: "u-1",
      prenom: "Jean",
      nom: "Dupont",
      email: "jean.dupont@example.com",
      poste: "Développeur",
    },
    vehicule: null,
    assigneA: null,
    ...overrides,
  }
}

function makeDemandeWithRelations(overrides?: {
  demande?: Record<string, unknown>
  vehicule?: Record<string, unknown> | null
  assigneA?: Record<string, unknown> | null
}): DemandeWithRelations {
  return {
    ...makeDemande(overrides?.demande),
    vehicule:
      overrides?.vehicule === null
        ? null
        : overrides?.vehicule
          ? {
              nom: overrides.vehicule.nom as string,
              immatriculation: overrides.vehicule.immatriculation as string,
            }
          : null,
    assigneA:
      overrides?.assigneA === null
        ? null
        : overrides?.assigneA
          ? {
              id: overrides.assigneA.id as string,
              nom: overrides.assigneA.nom as string,
              prenom: overrides.assigneA.prenom as string,
            }
          : null,
  }
}

describe("toPdfRenderData", () => {
  it("maps a full demande with all fields to PdfRenderData", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        motif: STORED_MOTIF_JSON,
        autreTransport: "Taxi",
        avanceRequise: true,
        montantAvance: 500,
        description: "Description test",
      },
      vehicule: { nom: "Renault Clio", immatriculation: "XY-999-ZZ" },
      assigneA: { id: "u-2", nom: "Bernard", prenom: "Pierre" },
    })

    const result = toPdfRenderData(demande)

    expect(result.numero).toBe("DD-2025-0001")
    expect(result.etape).toBe("FINANCE_REVIEW")
    expect(result.employeNom).toBe("Dupont")
    expect(result.employePrenom).toBe("Jean")
    expect(result.employePoste).toBe("Développeur")
    expect(result.employeDepartement).toBe("IT")
    expect(result.motifsLabels).toEqual(MOTIF_LABELS_EXPECTED)
    expect(result.dateDepart).toEqual(new Date("2025-06-01"))
    expect(result.dateRetour).toEqual(new Date("2025-06-05"))
    expect(result.destination).toBe("Casablanca")
    expect(result.typeTransport).toBe("AVION")
    expect(result.autreTransport).toBe("Taxi")
    expect(result.vehicule).toEqual({
      nom: "Renault Clio",
      immatriculation: "XY-999-ZZ",
    })
    expect(result.couts).toEqual({
      transport: 100,
      hebergement: 200,
      repas: 50,
      divers: 30,
      total: 380,
    })
    expect(result.avanceRequise).toBe(true)
    expect(result.montantAvance).toBe(500)
    expect(result.description).toBe("Description test")
    expect(result.creeLe).toEqual(new Date("2025-05-24"))
    expect(result.assigneA).toEqual({
      id: "u-2",
      nom: "Bernard",
      prenom: "Pierre",
    })
  })

  it("handles null vehicule and assigneA", () => {
    const demande = makeDemandeWithRelations({ vehicule: null, assigneA: null })
    const result = toPdfRenderData(demande)

    expect(result.vehicule).toBeNull()
    expect(result.assigneA).toBeNull()
  })

  it("maps null branding when none is passed", () => {
    const demande = makeDemandeWithRelations()
    const result = toPdfRenderData(demande)

    expect(result.branding).toBeNull()
  })

  it("maps branding to nom and couleurPrimaire", () => {
    const demande = makeDemandeWithRelations()
    const result = toPdfRenderData(demande, {
      id: "s-1",
      nom: "Acme SARL",
      logoUrl: "/logo.png",
      faviconUrl: "/favicon.ico",
      couleurPrimaire: "#0055aa",
    })

    expect(result.branding).toEqual({
      nom: "Acme SARL",
      couleurPrimaire: "#0055aa",
    })
  })

  it("maps branding with a null couleurPrimaire", () => {
    const demande = makeDemandeWithRelations()
    const result = toPdfRenderData(demande, {
      id: "s-1",
      nom: "Acme SARL",
      logoUrl: null,
      faviconUrl: null,
      couleurPrimaire: null,
    })

    expect(result.branding).toEqual({ nom: "Acme SARL", couleurPrimaire: null })
  })

  it("carries an unparseable stored Motif through verbatim", () => {
    const demande = makeDemandeWithRelations({ demande: { motif: "not-json" } })
    const result = toPdfRenderData(demande)

    expect(result.motifsLabels).toEqual(["not-json"])
  })

  it("converts string number fields to numbers", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        fraisTransport: "999",
        fraisHebergement: "888",
        fraisRepas: "777",
        fraisDivers: "666",
        totalEstime: "3330",
      },
    })

    const result = toPdfRenderData(demande)

    expect(result.couts.transport).toBe(999)
    expect(result.couts.hebergement).toBe(888)
    expect(result.couts.repas).toBe(777)
    expect(result.couts.divers).toBe(666)
    expect(result.couts.total).toBe(3330)
  })

  it("handles numeric values directly", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        fraisTransport: 42,
        fraisHebergement: 0,
        fraisRepas: 7,
        fraisDivers: 1,
        totalEstime: 50,
      },
    })

    const result = toPdfRenderData(demande)

    expect(result.couts.transport).toBe(42)
    expect(result.couts.hebergement).toBe(0)
    expect(result.couts.total).toBe(50)
  })
})

// The PDF renders the Motif the render data is handed — it holds no vocabulary
// of its own. So what the mapper must guarantee is that the render data is
// already labelled: the renderer is given "Mission client", never the slug
// "mission_client", and is given no slug it could fall back to. These
// assertions are what make a drift back to the stored entries impossible
// rather than merely unlikely.
describe("toPdfRenderData — the Motif it hands the renderer", () => {
  it("holds the French label, not the stored slug", () => {
    const result = toPdfRenderData(
      makeDemandeWithRelations({ demande: { motif: STORED_MOTIF_JSON } })
    )

    expect(result.motifsLabels).toContain(MOTIF_CANONICAL_LABEL)
    expect(result.motifsLabels).not.toContain(MOTIF_CANONICAL_SLUG)
  })

  it("preserves a stored free-text Motif verbatim", () => {
    const result = toPdfRenderData(
      makeDemandeWithRelations({ demande: { motif: STORED_MOTIF_JSON } })
    )

    expect(result.motifsLabels).toContain(MOTIF_FREE_TEXT)
  })

  it("labels every canonical Motif it is seeded with", () => {
    for (const [slug, label] of Object.entries(MOTIF_LABELS)) {
      const result = toPdfRenderData(
        makeDemandeWithRelations({
          demande: { motif: JSON.stringify([slug]) },
        })
      )

      expect(result.motifsLabels).toEqual([label])
      expect(result.motifsLabels).not.toContain(slug)
    }
  })

  it("never hands the renderer a stored value it would have to translate", () => {
    const result = toPdfRenderData(
      makeDemandeWithRelations({ demande: { motif: STORED_MOTIF_JSON } })
    )

    for (const label of result.motifsLabels) {
      expect(label).not.toBe("")
      expect(Object.keys(MOTIF_LABELS)).not.toContain(label)
    }
  })
})
