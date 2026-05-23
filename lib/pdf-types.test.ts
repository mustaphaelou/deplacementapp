import { expect, describe, it } from "vitest"
import type { CoutEstime, PdfRenderData } from "./pdf-types"

describe("PdfRenderData contract", () => {
  it("has all required fields with French names", () => {
    const couts: CoutEstime = {
      transport: 100,
      hebergement: 200,
      repas: 50,
      divers: 30,
      total: 380,
    }

    const data: PdfRenderData = {
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
      couts,
      avanceRequise: false,
      montantAvance: null,
      description: null,
      creeLe: new Date("2025-05-24"),
      assigneA: null,
    }

    expect(data.numero).toBe("DD-2025-0001")
    expect(data.statut).toBe("APPROUVEE_MANAGER")
    expect(data.employeNom).toBe("Dupont")
    expect(data.employePrenom).toBe("Jean")
    expect(data.employePoste).toBe("Développeur")
    expect(data.employeDepartement).toBe("IT")
    expect(data.motif).toEqual(["Réunion client"])
    expect(data.dateDepart).toEqual(new Date("2025-06-01"))
    expect(data.dateRetour).toEqual(new Date("2025-06-05"))
    expect(data.destination).toBe("Paris")
    expect(data.typeTransport).toBe("AVION")
    expect(data.autreTransport).toBeNull()
    expect(data.vehicule).toBeNull()
    expect(data.couts.transport).toBe(100)
    expect(data.couts.hebergement).toBe(200)
    expect(data.couts.repas).toBe(50)
    expect(data.couts.divers).toBe(30)
    expect(data.avanceRequise).toBe(false)
    expect(data.montantAvance).toBeNull()
    expect(data.description).toBeNull()
    expect(data.creeLe).toEqual(new Date("2025-05-24"))
    expect(data.assigneA).toBeNull()
  })

  it("allows valid assigneA with id, nom, prenom", () => {
    const couts: CoutEstime = {
      transport: 0,
      hebergement: 0,
      repas: 0,
      divers: 0,
      total: 0,
    }

    const data: PdfRenderData = {
      numero: "DD-2025-0002",
      statut: "BROUILLON",
      employeNom: "Martin",
      employePrenom: "Alice",
      employePoste: "Manager",
      employeDepartement: "RH",
      motif: ["Formation"],
      dateDepart: new Date("2025-07-01"),
      dateRetour: new Date("2025-07-03"),
      destination: "Lyon",
      typeTransport: "TRAIN",
      autreTransport: null,
      vehicule: null,
      couts,
      avanceRequise: true,
      montantAvance: 500,
      description: "Formation interne",
      creeLe: new Date("2025-05-24"),
      assigneA: { id: "u-1", nom: "Bernard", prenom: "Pierre" },
    }

    expect(data.assigneA).toEqual({ id: "u-1", nom: "Bernard", prenom: "Pierre" })
    expect(data.montantAvance).toBe(500)
    expect(data.description).toBe("Formation interne")
  })

  it("allows valid vehicule with nom and immatriculation", () => {
    const couts: CoutEstime = {
      transport: 0,
      hebergement: 0,
      repas: 0,
      divers: 0,
      total: 0,
    }

    const data: PdfRenderData = {
      numero: "DD-2025-0003",
      statut: "SOUMISE",
      employeNom: "Durand",
      employePrenom: "Marie",
      employePoste: "Commercial",
      employeDepartement: "Ventes",
      motif: ["Déplacement client"],
      dateDepart: new Date("2025-08-01"),
      dateRetour: new Date("2025-08-10"),
      destination: "Marseille",
      typeTransport: "VOITURE_SOCIETE",
      autreTransport: null,
      vehicule: { nom: "Peugeot 3008", immatriculation: "AB-123-CD" },
      couts,
      avanceRequise: false,
      montantAvance: null,
      description: null,
      creeLe: new Date("2025-05-24"),
      assigneA: null,
    }

    expect(data.vehicule).toEqual({ nom: "Peugeot 3008", immatriculation: "AB-123-CD" })
  })
})

// Regression: ensure the DTO imports work in a compiled context
export { type PdfRenderData, type CoutEstime }
