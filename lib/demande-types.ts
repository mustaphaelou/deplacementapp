import type { Role } from "./roles"
import type { CreateDemandeData } from "./demande-utils"

export function parseMotif(motif: string): string[] {
  try {
    const parsed = JSON.parse(motif)
    if (Array.isArray(parsed)) return parsed
    return [motif]
  } catch {
    return [motif]
  }
}

export type DemandeDeplacement = {
  id: string
  numero: string
  employeId: string
  assigneAId: string | null
  statut: string
  etape: string
  decision: string
  employeNom: string
  employePrenom: string
  employePoste: string
  employeDepartement: string
  motif: string
  dateDepart: Date
  dateRetour: Date
  destination: string
  typeTransport: string
  autreTransport: string | null
  vehiculeId: string | null
  fraisTransport: number | string | null
  fraisHebergement: number | string | null
  fraisRepas: number | string | null
  fraisDivers: number | string | null
  totalEstime: number | string | null
  avanceRequise: boolean
  montantAvance: number | string | null
  description: string | null
  commentaireManager: string | null
  commentaireFinance: string | null
  commentaireDirection: string | null
  soumiseLe: Date | null
  approuveeManagerLe: Date | null
  approuveeFinanceLe: Date | null
  approuveeDirectionLe: Date | null
  rejeteeLe: Date | null
  retireeLe: Date | null
  deletedAt: Date | null
  creeLe: Date
  modifieLe: Date
}

export type DemandeWithRelations = DemandeDeplacement & {
  employe: { id: string; prenom: string; nom: string; email: string; poste: string }
  vehicule: { nom: string; immatriculation: string } | null
  assigneA: { id: string; prenom: string; nom: string } | null
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

export type Vehicule = { id: string; nom: string; immatriculation: string; disponible: boolean }

export interface Actor {
  id: string
  role: Role
}

export type ExecuteParams =
  | { action: "create"; data: CreateDemandeData; actor: Actor }
  | { action: "submit"; data: CreateDemandeData; actor: Actor }
  | { action: "submit_draft"; demandeId: string; actor: Actor }
  | { action: "approuver"; demandeId: string; actor: Actor; comment?: string }
  | { action: "rejeter"; demandeId: string; actor: Actor; comment: string }
  | { action: "retirer"; demandeId: string; actor: Actor }
