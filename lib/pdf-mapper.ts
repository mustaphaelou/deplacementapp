import type { PdfRenderData } from "./pdf-types"
import { type DemandeWithRelations } from "./demande-types"
import { toDemandeDocumentView } from "./demande-presentation"
import type { SocieteBranding } from "./societe"

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (
    value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value) || 0
}

export function toPdfRenderData(
  demande: DemandeWithRelations,
  branding: SocieteBranding | null = null
): PdfRenderData {
  const view = toDemandeDocumentView(demande)

  return {
    numero: demande.numero,
    etape: demande.etape,
    decision: demande.decision,
    employeNom: demande.employeNom,
    employePrenom: demande.employePrenom,
    employePoste: demande.employePoste,
    employeDepartement: demande.employeDepartement,
    motifsLabels: view.motifs,
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    destination: demande.destination,
    typeTransport: demande.typeTransport,
    autreTransport: demande.autreTransport,
    vehicule: demande.vehicule
      ? {
          nom: demande.vehicule.nom,
          immatriculation: demande.vehicule.immatriculation,
        }
      : null,
    couts: {
      transport: toNumber(demande.fraisTransport),
      hebergement: toNumber(demande.fraisHebergement),
      repas: toNumber(demande.fraisRepas),
      divers: toNumber(demande.fraisDivers),
      total: toNumber(demande.totalEstime),
    },
    avanceRequise: demande.avanceRequise,
    montantAvance: demande.montantAvance
      ? toNumber(demande.montantAvance)
      : null,
    description: demande.description,
    creeLe: demande.creeLe,
    assigneA: demande.assigneA
      ? {
          id: demande.assigneA.id,
          nom: demande.assigneA.nom,
          prenom: demande.assigneA.prenom,
        }
      : null,
    branding: branding
      ? { nom: branding.nom, couleurPrimaire: branding.couleurPrimaire }
      : null,
  }
}
