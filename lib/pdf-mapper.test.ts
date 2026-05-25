import { expect, describe, it } from "vitest"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise } from "@prisma/client"
import { toPdfRenderData, type DemandeWithRelations } from "./pdf-mapper"

function makeDemande(overrides?: Partial<DemandeDeplacement>): DemandeDeplacement {
  return {
    id: "d-1",
    numero: "DD-2025-0001",
    employeId: "u-1",
    assigneAId: null,
    statut: "APPROUVEE_MANAGER" as any,
    employeNom: "Dupont",
    employePrenom: "Jean",
    employePoste: "Développeur",
    employeDepartement: "IT",
    motif: '["Réunion client","Formation"]',
    dateDepart: new Date("2025-06-01"),
    dateRetour: new Date("2025-06-05"),
    destination: "Casablanca",
    typeTransport: "AVION" as any,
    autreTransport: null,
    vehiculeId: null,
    fraisTransport: { toNumber: () => 100 } as any,
    fraisHebergement: { toNumber: () => 200 } as any,
    fraisRepas: { toNumber: () => 50 } as any,
    fraisDivers: { toNumber: () => 30 } as any,
    totalEstime: { toNumber: () => 380 } as any,
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
    ...overrides,
  }
}

function makeEmploye(overrides?: Partial<Utilisateur>): Utilisateur {
  return {
    id: "u-1",
    email: "jean.dupont@example.com",
    motDePasse: "hashed",
    nom: "Dupont",
    prenom: "Jean",
    poste: "Développeur",
    role: "EMPLOYEE" as any,
    departementId: "dep-1",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2020-01-01"),
    modifieLe: new Date("2020-01-01"),
    ...overrides,
  }
}

function makeVehicule(overrides?: Partial<VehiculeEntreprise>): VehiculeEntreprise {
  return {
    id: "v-1",
    nom: "Peugeot 3008",
    immatriculation: "AB-123-CD",
    disponible: true,
    creeLe: new Date("2023-01-01"),
    ...overrides,
  }
}

function makeDemandeWithRelations(overrides?: {
  demande?: Partial<DemandeDeplacement>
  employe?: Partial<Utilisateur>
  vehicule?: Partial<VehiculeEntreprise> | null
  assigneA?: Partial<Utilisateur> | null
}): DemandeWithRelations {
  return {
    ...makeDemande(overrides?.demande),
    employe: makeEmploye(overrides?.employe),
    vehicule: overrides?.vehicule === null ? null : makeVehicule(overrides?.vehicule),
    assigneA: overrides?.assigneA === null ? null : overrides?.assigneA ? makeEmploye(overrides.assigneA) : null,
  }
}

describe("toPdfRenderData", () => {
  it("maps a full demande with all fields to PdfRenderData", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        motif: '["Réunion client","Formation"]',
        autreTransport: "Taxi",
        avanceRequise: true,
        montantAvance: { toNumber: () => 500 } as any,
        description: "Description test",
      },
      vehicule: { nom: "Renault Clio", immatriculation: "XY-999-ZZ" },
      assigneA: { id: "u-2", nom: "Bernard", prenom: "Pierre" } as any,
    })

    const result = toPdfRenderData(demande)

    expect(result.numero).toBe("DD-2025-0001")
    expect(result.statut).toBe("APPROUVEE_MANAGER")
    expect(result.employeNom).toBe("Dupont")
    expect(result.employePrenom).toBe("Jean")
    expect(result.employePoste).toBe("Développeur")
    expect(result.employeDepartement).toBe("IT")
    expect(result.motif).toEqual(["Réunion client", "Formation"])
    expect(result.dateDepart).toEqual(new Date("2025-06-01"))
    expect(result.dateRetour).toEqual(new Date("2025-06-05"))
    expect(result.destination).toBe("Casablanca")
    expect(result.typeTransport).toBe("AVION")
    expect(result.autreTransport).toBe("Taxi")
    expect(result.vehicule).toEqual({ nom: "Renault Clio", immatriculation: "XY-999-ZZ" })
    expect(result.couts).toEqual({ transport: 100, hebergement: 200, repas: 50, divers: 30, total: 380 })
    expect(result.avanceRequise).toBe(true)
    expect(result.montantAvance).toBe(500)
    expect(result.description).toBe("Description test")
    expect(result.creeLe).toEqual(new Date("2025-05-24"))
    expect(result.assigneA).toEqual({ id: "u-2", nom: "Bernard", prenom: "Pierre" })
  })

  it("handles null vehicule and assigneA", () => {
    const demande = makeDemandeWithRelations({ vehicule: null, assigneA: null })
    const result = toPdfRenderData(demande)

    expect(result.vehicule).toBeNull()
    expect(result.assigneA).toBeNull()
  })

  it("falls back to raw motif string when JSON.parse fails", () => {
    const demande = makeDemandeWithRelations({ demande: { motif: "not-json" } })
    const result = toPdfRenderData(demande)

    expect(result.motif).toEqual(["not-json"])
  })

  it("converts Decimal fields to numbers", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        fraisTransport: { toNumber: () => 999 } as any,
        fraisHebergement: { toNumber: () => 888 } as any,
        fraisRepas: { toNumber: () => 777 } as any,
        fraisDivers: { toNumber: () => 666 } as any,
        totalEstime: { toNumber: () => 3330 } as any,
      },
    })

    const result = toPdfRenderData(demande)

    expect(result.couts.transport).toBe(999)
    expect(result.couts.hebergement).toBe(888)
    expect(result.couts.repas).toBe(777)
    expect(result.couts.divers).toBe(666)
    expect(result.couts.total).toBe(3330)
  })

  it("handles missing Decimal toNumber by coercing via Number()", () => {
    const demande = makeDemandeWithRelations({
      demande: {
        fraisTransport: 42 as any,
        fraisHebergement: 0 as any,
        fraisRepas: 7 as any,
        fraisDivers: 1 as any,
        totalEstime: 50 as any,
      },
    })

    const result = toPdfRenderData(demande)

    expect(result.couts.transport).toBe(42)
    expect(result.couts.hebergement).toBe(0)
    expect(result.couts.total).toBe(50)
  })
})
