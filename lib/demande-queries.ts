import type { Prisma, PrismaClient, StatutDemande } from "@prisma/client"
import type { DashboardDemandeSummary } from "./dashboard"
import { DemandeNotFoundError } from "./errors"
import { mapToDemandeSummary } from "./demande-utils"

export interface DemandeQueryParams {
  page: number
  limit: number
  statut?: string
  recherche?: string
}

export class DemandeQueries {
  constructor(private db: PrismaClient) {}

  async findById(id: string) {
    const demande = await this.db.demandeDeplacement.findUnique({
      where: { id },
      include: {
        employe: { select: { id: true, prenom: true, nom: true, email: true, poste: true } },
        assigneA: { select: { id: true, prenom: true, nom: true } },
        vehicule: { select: { nom: true, immatriculation: true } },
        documents: { select: { id: true, type: true, creeLe: true } },
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

    return { demandes: demandes.map(mapToDemandeSummary), total }
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
    return demandes.map(mapToDemandeSummary)
  }

  async findByStatuts(
    statuts: StatutDemande[],
    opts: { limit?: number; includeEmployee?: boolean; orderBy?: any } = {}
  ): Promise<DashboardDemandeSummary[]> {
    const { limit = 10, includeEmployee = false, orderBy = { creeLe: "desc" } } = opts
    const demandes = await this.db.demandeDeplacement.findMany({
      where: { statut: { in: statuts }, deletedAt: null },
      orderBy,
      take: limit,
      include: includeEmployee ? { employe: { select: { prenom: true, nom: true } } } : undefined,
    })
    return demandes.map(mapToDemandeSummary)
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
}
