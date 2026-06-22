import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise } from "@prisma/client"

export function parseMotif(motif: string): string[] {
  try {
    const parsed = JSON.parse(motif)
    if (Array.isArray(parsed)) return parsed
    return [motif]
  } catch {
    return [motif]
  }
}

export type DemandeWithRelations = DemandeDeplacement & {
  employe: Utilisateur
  vehicule: VehiculeEntreprise | null
  assigneA: Utilisateur | null
}

export interface DemandeDetail {
  id: string
  numero: string
  employeId: string
  statut: string
  employePrenom: string
  employeNom: string
  employePoste: string
  employeDepartement: string
  motif: string
  dateDepart: string
  dateRetour: string
  destination: string
  typeTransport: string
  autreTransport: string | null
  vehicule: { nom: string; immatriculation: string } | null
  fraisTransport: number | null
  fraisHebergement: number | null
  fraisRepas: number | null
  fraisDivers: number | null
  totalEstime: number | null
  avanceRequise: boolean
  montantAvance: number | null
  description: string | null
  commentaireManager: string | null
  commentaireFinance: string | null
  commentaireDirection: string | null
  soumiseLe: string | null
  approuveeManagerLe: string | null
  approuveeFinanceLe: string | null
  approuveeDirectionLe: string | null
  rejeteeLe: string | null
  retireeLe: string | null
  employe: { id: string; prenom: string; nom: string; email: string; poste: string }
  assigneA: { id: string; prenom: string; nom: string } | null
  documents: { id: string; type: string; creeLe: string }[]
  creeLe: string
  modifieLe: string
}

export type Vehicule = Pick<VehiculeEntreprise, "id" | "nom" | "immatriculation" | "disponible">
