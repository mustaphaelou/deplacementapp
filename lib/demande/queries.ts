import {
  eq,
  and,
  isNull,
  ilike,
  or,
  desc,
  asc,
  inArray,
  count,
  sum,
  type SQL,
} from "drizzle-orm"
import { db } from "../../db"
import { demandesDeplacement } from "../../db/schema/demandes-deplacement"
import type { DemandeWithRelations } from "../demande-types"
import type { DashboardDemandeSummary } from "../dashboard"
import type { Etape, TimestampColumn } from "../workflow"
import type { Actor } from "../demande-types"
import { DemandeNotFoundError } from "../errors"

export interface Document {
  id: string
  demandeId: string
  type: string
  chemin: string
  creeLe: Date
}

export type OrderByTimestamp = {
  column: TimestampColumn
  direction: "asc" | "desc"
}

export type DemandeFindByIdInclude = {
  [K in keyof DemandeFindByIdIncludableRelations]?: boolean
}

type DemandeFindByIdIncludableRelations = {
  documents: Document
}

export type DemandeFindByIdExtra<I extends DemandeFindByIdInclude> = {
  [
    K in keyof I & keyof DemandeFindByIdIncludableRelations as I[K] extends true
      ? K
      : never
  ]: DemandeFindByIdIncludableRelations[K][]
}

export interface DemandeExportRow {
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  typeTransport: string
  totalEstime: number | null
  etape: string
  decision: string
  creeLe: Date
  employe: { prenom: string; nom: string } | null
}

export interface DemandeQueryParams {
  page: number
  limit: number
  etape?: string
  recherche?: string
}

function mapToDemandeSummary(demande: {
  id: string
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  totalEstime: string | null
  etape: string
  decision: string
  employe: { prenom: string; nom: string } | null
}): DashboardDemandeSummary {
  return {
    id: demande.id,
    numero: demande.numero,
    destination: demande.destination,
    dateDepart: demande.dateDepart,
    dateRetour: demande.dateRetour,
    totalEstime: demande.totalEstime ? Number(demande.totalEstime) : null,
    etape: demande.etape,
    decision: demande.decision,
    employe: demande.employe ?? null,
  }
}

function visibilityCondition(actor: Actor): SQL | undefined {
  return actor.role === "EMPLOYEE"
    ? eq(demandesDeplacement.employeId, actor.id)
    : undefined
}

function buildWithClause(options?: { include?: DemandeFindByIdInclude }) {
  const withClause: Record<
    string,
    true | { columns: Record<string, boolean> }
  > = {
    employe: {
      columns: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        poste: true,
      },
    },
    assigneA: { columns: { id: true, prenom: true, nom: true } },
    vehicule: { columns: { nom: true, immatriculation: true } },
  }
  if (options?.include?.documents) {
    withClause.documents = true
  }
  return withClause
}

export async function findById(
  id: string,
  actor: Actor
): Promise<DemandeWithRelations>
export async function findById<I extends DemandeFindByIdInclude>(
  id: string,
  actor: Actor,
  options: { include: I }
): Promise<DemandeWithRelations & DemandeFindByIdExtra<I>>
export async function findById(
  id: string,
  actor: Actor,
  options?: { include?: DemandeFindByIdInclude }
): Promise<DemandeWithRelations> {
  const demande = await db.query.demandesDeplacement.findFirst({
    where: and(
      eq(demandesDeplacement.id, id),
      isNull(demandesDeplacement.deletedAt),
      visibilityCondition(actor)
    ),
    with: buildWithClause(options),
  })
  if (!demande) throw new DemandeNotFoundError()
  return demande as unknown as DemandeWithRelations
}

export async function findMany(
  actor: Actor,
  params: DemandeQueryParams
): Promise<{ demandes: DashboardDemandeSummary[]; total: number }> {
  const { page, limit, etape, recherche } = params
  const conditions: (SQL | undefined)[] = [
    isNull(demandesDeplacement.deletedAt),
    visibilityCondition(actor),
  ]

  if (etape) {
    conditions.push(eq(demandesDeplacement.etape, etape as Etape))
  }

  if (recherche) {
    conditions.push(
      or(
        ilike(demandesDeplacement.destination, `%${recherche}%`),
        ilike(demandesDeplacement.numero, `%${recherche}%`)
      )
    )
  }

  const [demandes, countResult] = await Promise.all([
    db.query.demandesDeplacement.findMany({
      where: and(...conditions),
      orderBy: [desc(demandesDeplacement.creeLe)],
      limit,
      offset: (page - 1) * limit,
      with: {
        employe: { columns: { id: true, prenom: true, nom: true } },
      },
    }),
    db
      .select({ value: count() })
      .from(demandesDeplacement)
      .where(and(...conditions))
      .then((r) => r[0]?.value ?? 0),
  ])

  return {
    demandes: demandes.map((d) => mapToDemandeSummary(d)),
    total: countResult,
  }
}

export async function findByEmployeeId(
  userId: string,
  limit = 5
): Promise<DashboardDemandeSummary[]> {
  const demandes = await db.query.demandesDeplacement.findMany({
    where: and(
      eq(demandesDeplacement.employeId, userId),
      isNull(demandesDeplacement.deletedAt)
    ),
    orderBy: [desc(demandesDeplacement.creeLe)],
    limit,
    with: { employe: { columns: { prenom: true, nom: true } } },
  })
  return demandes.map((d) => mapToDemandeSummary(d))
}

export async function findByEtapes(
  etapes: Etape[],
  opts: {
    limit?: number
    includeEmployee?: boolean
    orderBy?: OrderByTimestamp
  } = {}
): Promise<DashboardDemandeSummary[]> {
  const {
    limit: take = 10,
    orderBy = { column: "creeLe" as const, direction: "desc" as const },
  } = opts
  const col =
    demandesDeplacement[orderBy.column as keyof typeof demandesDeplacement]
  const orderFn = orderBy.direction === "desc" ? desc : asc
  const demandes = await db.query.demandesDeplacement.findMany({
    where: and(
      inArray(demandesDeplacement.etape, etapes),
      isNull(demandesDeplacement.deletedAt)
    ),
    orderBy: [orderFn(col as typeof demandesDeplacement.creeLe)],
    limit: take,
    with: { employe: { columns: { prenom: true, nom: true } } },
  })
  return demandes.map((d) => mapToDemandeSummary(d))
}

export async function countByEtape(
  etape: Etape,
  userId?: string
): Promise<number> {
  const conditions: (SQL | undefined)[] = [
    eq(demandesDeplacement.etape, etape),
    isNull(demandesDeplacement.deletedAt),
  ]
  if (userId) conditions.push(eq(demandesDeplacement.employeId, userId))
  const result = await db
    .select({ value: count() })
    .from(demandesDeplacement)
    .where(and(...conditions))
  return result[0]?.value ?? 0
}

export async function aggregateBudget(etapes: Etape[]): Promise<number> {
  const result = await db
    .select({ total: sum(demandesDeplacement.totalEstime) })
    .from(demandesDeplacement)
    .where(
      and(
        inArray(demandesDeplacement.etape, etapes),
        isNull(demandesDeplacement.deletedAt)
      )
    )
  return Number(result[0]?.total ?? 0)
}

export async function findAllForExport(): Promise<DemandeExportRow[]> {
  const demandes = await db.query.demandesDeplacement.findMany({
    where: isNull(demandesDeplacement.deletedAt),
    orderBy: [desc(demandesDeplacement.creeLe)],
    with: {
      employe: { columns: { prenom: true, nom: true } },
    },
  })
  return demandes.map((d) => ({
    numero: d.numero,
    destination: d.destination,
    dateDepart: d.dateDepart,
    dateRetour: d.dateRetour,
    typeTransport: d.typeTransport,
    totalEstime: d.totalEstime != null ? Number(d.totalEstime) : null,
    etape: d.etape,
    decision: d.decision,
    creeLe: d.creeLe,
    employe: d.employe
      ? { prenom: d.employe.prenom, nom: d.employe.nom }
      : null,
  }))
}
