import type { PdfRenderData } from "./pdf-types"
import { parseMotif, type DemandeWithRelations } from "./demande-types"

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value) || 0
}

export function toPdfRenderData(demande: DemandeWithRelations): PdfRenderData {
  return {
    numero: demande.numero,
    statut: demande.statut,
    employeNom: demande.employeNom,
    employePrenom: demande.employePrenom,
    employePoste: demande.employePoste,
    employeDepartement: demande.employeDepartement,
    motif: parseMotif(demande.motif),
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    destination: demande.destination,
    typeTransport: demande.typeTransport,
    autreTransport: demande.autreTransport,
    vehicule: demande.vehicule
      ? { nom: demande.vehicule.nom, immatriculation: demande.vehicule.immatriculation }
      : null,
    couts: {
      transport: toNumber(demande.fraisTransport),
      hebergement: toNumber(demande.fraisHebergement),
      repas: toNumber(demande.fraisRepas),
      divers: toNumber(demande.fraisDivers),
      total: toNumber(demande.totalEstime),
    },
    avanceRequise: demande.avanceRequise,
    montantAvance: demande.montantAvance ? toNumber(demande.montantAvance) : null,
    description: demande.description,
    creeLe: demande.creeLe,
    assigneA: demande.assigneA
      ? { id: demande.assigneA.id, nom: demande.assigneA.nom, prenom: demande.assigneA.prenom }
      : null,
  }
}
