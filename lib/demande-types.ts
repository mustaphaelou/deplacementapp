import type { Role } from "@/lib/auth"
import type { demandesDeplacement } from "@/db/schema/demandes-deplacement"
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

// The row type is DERIVED from the schema's own inferred row rather than
// transcribed by hand (#295). `etape` and `decision` are native `pgEnum`
// columns, so the inferred row carries the pipeline's exact unions and the
// four `as Etape` / `as Decision` casts this widening forced are gone.
//
// The money columns are the one deliberate exception: drizzle types a
// `decimal` column as the string Postgres returns, while every surface that
// consumes a DemandeDeplacement also accepts a number (the fixtures, the PDF
// mapper's `toNumber`, the print page's `Number(...)`). Re-declaring just
// those six keeps them honest at both ends and leaves the Etape/Decision
// narrowing — the point of the ticket — derived rather than restated.
type SchemaRow = typeof demandesDeplacement.$inferSelect

export type DemandeDeplacement = Omit<
  SchemaRow,
  | "fraisTransport"
  | "fraisHebergement"
  | "fraisRepas"
  | "fraisDivers"
  | "totalEstime"
  | "montantAvance"
> & {
  fraisTransport: number | string | null
  fraisHebergement: number | string | null
  fraisRepas: number | string | null
  fraisDivers: number | string | null
  totalEstime: number | string | null
  montantAvance: number | string | null
}

export type DemandeWithRelations = DemandeDeplacement & {
  employe: {
    id: string
    prenom: string
    nom: string
    email: string
    poste: string
  }
  vehicule: { nom: string; immatriculation: string } | null
  assigneA: { id: string; prenom: string; nom: string } | null
}

export interface DemandeDetail {
  id: string
  numero: string
  employeId: string
  etape: string
  decision: string
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
  employe: {
    id: string
    prenom: string
    nom: string
    email: string
    poste: string
  }
  assigneA: { id: string; prenom: string; nom: string } | null
  documents: { id: string; type: string; creeLe: string }[]
  creeLe: string
  modifieLe: string
}

export type Vehicule = {
  id: string
  nom: string
  immatriculation: string
  disponible: boolean
}

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
