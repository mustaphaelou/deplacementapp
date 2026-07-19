import type { Document, Prisma, PrismaClient, StatutDemande } from "@prisma/client"
import type { DashboardDemandeSummary } from "./dashboard"
import type { DemandeWithRelations } from "./demande-types"
import { DemandeNotFoundError } from "./errors"
import type { TimestampColumn } from "./workflow"

export type OrderByTimestamp = { period: TimestampColumn; direction: "asc" | "desc" }

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

type DemandeFindByIdIncludableRelations = {
  documents: Document
}

export type DemandeFindByIdInclude = {
  [K in keyof DemandeFindByIdIncludableRelations]?: boolean
}

export type DemandeFindByIdExtra<I extends DemandeFindByIdInclude> = {
  [K in keyof I & keyof DemandeFindByIdIncludableRelations as I[K] extends true ? K : never]: DemandeFindByIdIncludableRelations[K][]
}

export interface DemandeQueriesPort {
  findById(id: string): Promise<DemandeWithRelations>
  findById<I extends DemandeFindByIdInclude>(
    id: string,
    options: { include: I }
  ): Promise<DemandeWithRelations & DemandeFindByIdExtra<I>>
  findMany(role: string, userId: string, params: DemandeQueryParams): Promise<{ demandes: DashboardDemandeSummary[]; total: number }>
  findByEmployeeId(userId: string, limit?: number): Promise<DashboardDemandeSummary[]>
  findByStatuts(statuts: StatutDemande[], opts?: { limit?: number; includeEmployee?: boolean; orderBy?: any | OrderByTimestamp }): Promise<DashboardDemandeSummary[]>
  countByStatut(statut: StatutDemande, userId?: string): Promise<number>
  aggregateBudget(statuts: StatutDemande[]): Promise<number>
  findAllForExport(): Promise<DemandeExportRow[]>
}

export interface DemandeQueryParams {
  page: number
  limit: number
  statut?: string
  recherche?: string
}

export class DemandeQueries {
  constructor(private db: PrismaClient) {}

  private mapToDemandeSummary(demande: any): DashboardDemandeSummary {
    return {
      id: demande.id,
      numero: demande.numero,
      destination: demande.destination,
      dateDepart: demande.dateDepart,
      dateRetour: demande.dateRetour,
      totalEstime: demande.totalEstime ? Number(demande.totalEstime) : null,
      statut: demande.statut,
      employe: demande.employe
        ? { prenom: demande.employe.prenom, nom: demande.employe.nom }
        : null,
    }
  }

  findById(id: string): Promise<DemandeWithRelations>
  findById<I extends DemandeFindByIdInclude>(
    id: string,
    options: { include: I }
  ): Promise<DemandeWithRelations & DemandeFindByIdExtra<I>>
  async findById(
    id: string,
    options?: { include?: DemandeFindByIdInclude }
  ): Promise<DemandeWithRelations> {
    const demande = await this.db.demandeDeplacement.findUnique({
      where: { id, deletedAt: null },
      include: {
        employe: { select: { id: true, prenom: true, nom: true, email: true, poste: true } },
        assigneA: { select: { id: true, prenom: true, nom: true } },
        vehicule: { select: { nom: true, immatriculation: true } },
        ...(options?.include?.documents ? { documents: true } : {}),
      },
    })
    if (!demande || demande.deletedAt) throw new DemandeNotFoundError()
    return demande
  }

  async findMany(
    role: string,
    userId: string,
    params: DemandeQueryParams
  ): Promise<{ demandes: DashboardDemandeSummary[]; total: number }> {
    const { page, limit, statut, recherche } = params
    const where: any = { deletedAt: null }

    if (role === "EMPLOYEE") {
      where.employeId = userId
    }

    if (statut) {
      where.statut = statut
    }

    if (recherche) {
      where.OR = [
        { destination: { contains: recherche, mode: "insensitive" } },
        { numero: { contains: recherche, mode: "insensitive" } },
      ]
    }

    const [demandes, total] = await Promise.all([
      this.db.demandeDeplacement.findMany({
        where,
        orderBy: { creeLe: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employe: { select: { id: true, prenom: true, nom: true } },
        },
      }),
      this.db.demandeDeplacement.count({ where }),
    ])

    return { demandes: demandes.map((d) => this.mapToDemandeSummary(d)), total }
  }

  async findByEmployeeId(
    userId: string,
    limit = 5
  ): Promise<DashboardDemandeSummary[]> {
    const demandes = await this.db.demandeDeplacement.findMany({
      where: { employeId: userId, deletedAt: null },
      orderBy: { creeLe: "desc" },
      take: limit,
    })
    return demandes.map((d) => this.mapToDemandeSummary(d))
  }

  async findByStatuts(
    statuts: StatutDemande[],
    opts: { limit?: number; includeEmployee?: boolean; orderBy?: any | OrderByTimestamp } = {}
  ): Promise<DashboardDemandeSummary[]> {
    const { limit = 10, includeEmployee = false, orderBy = { creeLe: "desc" } } = opts
    const prismaOrderBy = orderBy && "period" in orderBy
      ? { [orderBy.period]: orderBy.direction }
      : orderBy
    const demandes = await this.db.demandeDeplacement.findMany({
      where: { statut: { in: statuts }, deletedAt: null },
      orderBy: prismaOrderBy,
      take: limit,
      include: includeEmployee ? { employe: { select: { prenom: true, nom: true } } } : undefined,
    })
    return demandes.map((d) => this.mapToDemandeSummary(d))
  }

  async countByStatut(
    statut: StatutDemande,
    userId?: string
  ): Promise<number> {
    const where: Prisma.DemandeDeplacementCountArgs["where"] = {
      statut,
      deletedAt: null,
    }
    if (userId) where.employeId = userId
    return this.db.demandeDeplacement.count({ where })
  }

  async aggregateBudget(statuts: StatutDemande[]): Promise<number> {
    const result = await this.db.demandeDeplacement.aggregate({
      _sum: { totalEstime: true },
      where: { statut: { in: statuts }, deletedAt: null },
    })
    return Number(result._sum?.totalEstime ?? 0)
  }

  async findAllForExport(): Promise<DemandeExportRow[]> {
    const demandes = await this.db.demandeDeplacement.findMany({
      where: { deletedAt: null },
      orderBy: { creeLe: "desc" },
      include: {
        employe: { select: { prenom: true, nom: true } },
      },
    })
    return demandes.map((d) => ({
      numero: d.numero,
      destination: d.destination,
      dateDepart: d.dateDepart,
      dateRetour: d.dateRetour,
      typeTransport: d.typeTransport,
      totalEstime: d.totalEstime != null ? Number(d.totalEstime) : null,
      statut: d.statut,
      creeLe: d.creeLe,
      employe: d.employe ? { prenom: d.employe.prenom, nom: d.employe.nom } : null,
    }))
  }
}
