import type { StatutDemande, Document } from "@prisma/client"
import type { DashboardDemandeSummary } from "../../dashboard"
import type { DemandeWithRelations } from "../../demande-types"
import type { TimestampColumn } from "../../workflow"

export type OrderByTimestamp = { column: TimestampColumn; direction: "asc" | "desc" }

export type DemandeFindByIdInclude = {
  [K in keyof DemandeFindByIdIncludableRelations]?: boolean
}

type DemandeFindByIdIncludableRelations = {
  documents: Document
}

export type DemandeFindByIdExtra<I extends DemandeFindByIdInclude> = {
  [K in keyof I & keyof DemandeFindByIdIncludableRelations as I[K] extends true ? K : never]: DemandeFindByIdIncludableRelations[K][]
}

export interface DemandeExportRow {
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  typeTransport: string
  totalEstime: number | null
  statut: string
  creeLe: Date
  employe: { prenom: string; nom: string } | null
}

export interface DemandeQueryParams {
  page: number
  limit: number
  statut?: string
  recherche?: string
}

export interface DemandeQueryPort {
  findById(id: string): Promise<DemandeWithRelations>
  findById<I extends DemandeFindByIdInclude>(
    id: string,
    options: { include: I }
  ): Promise<DemandeWithRelations & DemandeFindByIdExtra<I>>

  findMany(
    role: string,
    userId: string,
    params: DemandeQueryParams
  ): Promise<{ demandes: DashboardDemandeSummary[]; total: number }>

  findByEmployeeId(
    userId: string,
    limit?: number
  ): Promise<DashboardDemandeSummary[]>

  findByStatuts(
    statuts: StatutDemande[],
    opts?: { limit?: number; includeEmployee?: boolean; orderBy?: OrderByTimestamp }
  ): Promise<DashboardDemandeSummary[]>

  countByStatut(
    statut: StatutDemande,
    userId?: string
  ): Promise<number>

  aggregateBudget(
    statuts: StatutDemande[]
  ): Promise<number>

  findAllForExport(): Promise<DemandeExportRow[]>
}