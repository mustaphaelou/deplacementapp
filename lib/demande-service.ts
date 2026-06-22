import type { Prisma, PrismaClient, TypeTransport, Role, StatutDemande } from "@prisma/client"
import type { NotificationEventType, NotificationPayload } from "./notification-bus"
import type { DashboardDemandeSummary } from "./dashboard"
import { prisma } from "./prisma"
import { notificationBus } from "./notification-bus"
import { auditBus } from "./audit-bus"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./errors"
import { canTransition, buildTransition, fromLegacyStatus } from "./workflow"
import type { WorkflowAction } from "./workflow"

export {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface Actor {
  id: string
  role: Role
}

export function mapToDemandeSummary(demande: any): DashboardDemandeSummary {
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

export interface CreateDemandeData {
  motif: string[]
  motifAutre?: string
  dateDepart: string
  dateRetour: string
  destination: string
  typeTransport: TypeTransport
  autreTransport?: string
  vehiculeId?: string
  fraisTransport?: string
  fraisHebergement?: string
  fraisRepas?: string
  fraisDivers?: string
  avanceRequise?: boolean
  montantAvance?: string
  description?: string
}

export type ExecuteParams =
  | { action: "create"; data: CreateDemandeData; actor: Actor }
  | { action: "submit"; data: CreateDemandeData; actor: Actor }
  | { action: "approuver"; demandeId: string; actor: Actor; comment?: string }
  | { action: "rejeter"; demandeId: string; actor: Actor; comment: string }
  | { action: "retirer"; demandeId: string; actor: Actor }

// ─── Service ───────────────────────────────────────────────────────────────

export class DemandeDeplacementService {
  constructor(
    private db: PrismaClient,
    private notifications = notificationBus,
    private audit = auditBus
  ) {}

  async executeAction(params: ExecuteParams) {
    switch (params.action) {
      case "create":
      case "submit":
        return this.handleCreate(params)
      case "approuver":
      case "rejeter":
      case "retirer":
        return this.handleTransition(params)
    }
  }

  // ── Read queries ──────────────────────────────────────────────────

  async getDemandesByUser(
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

  async getDemandesByStatuts(
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

  // ── Create (draft or submit-and-transition) ──────────────────────────

  private async handleCreate(
    params: Extract<ExecuteParams, { action: "create" | "submit" }>
  ) {
    const { action, data, actor } = params

    const user = await this.db.utilisateur.findUnique({
      where: { id: actor.id },
      include: { departement: true },
    })
    if (!user) throw new UnauthorizedActionError("Utilisateur introuvable")

    const nextNum = (await this.db.demandeDeplacement.count()) + 1
    const numero = `DD-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`

    const motifArray = this.processMotif(data.motif, data.motifAutre)
    const totalEstime = this.computeTotalEstime(data)

    const createData: Prisma.DemandeDeplacementUncheckedCreateInput = {
      numero,
      employeId: user.id,
      statut: "BROUILLON",
      employeNom: user.nom,
      employePrenom: user.prenom,
      employePoste: user.poste,
      employeDepartement: user.departement.nom,
      motif: JSON.stringify(motifArray),
      dateDepart: new Date(data.dateDepart),
      dateRetour: new Date(data.dateRetour),
      destination: data.destination,
      typeTransport: data.typeTransport,
      autreTransport: data.autreTransport || null,
      vehiculeId: data.vehiculeId || null,
      fraisTransport: this.parseDecimal(data.fraisTransport),
      fraisHebergement: this.parseDecimal(data.fraisHebergement),
      fraisRepas: this.parseDecimal(data.fraisRepas),
      fraisDivers: this.parseDecimal(data.fraisDivers),
      totalEstime,
      avanceRequise: data.avanceRequise || false,
      montantAvance: data.avanceRequise ? this.parseDecimal(data.montantAvance) : null,
      description: data.description || null,
      soumiseLe: null,
    }

    let auditAction = "CREATION"
    let notificationEvent: NotificationEventType | null = null
    let notificationPayload: { employe: { id: string; prenom: string; nom: string } } | null = null

    if (action === "submit") {
      const transition = buildTransition("EMPLOYEE", "DRAFT", "submit")
      if (!transition) throw new InvalidTransitionError("Soumission impossible")
      Object.assign(createData, transition.transition.fields)
      auditAction = transition.auditAction
      notificationEvent = transition.notificationEvent
      notificationPayload = {
        employe: { id: user.id, prenom: user.prenom, nom: user.nom },
      }
    }

    const demande = await this.db.demandeDeplacement.create({
      data: createData,
    })

    await this.audit.log({
      utilisateurId: user.id,
      action: auditAction,
      entite: "DemandeDeplacement",
      entiteId: demande.id,
      details: { numero },
    })

    if (notificationEvent && notificationPayload) {
      await this.notifications.dispatch(notificationEvent, {
        demandeId: demande.id,
        numero: demande.numero,
        ...notificationPayload,
      })
    }

    return { demande }
  }

  // ── Transition (approve / reject / withdraw) ──────────────────────────

  private async handleTransition(
    params: Extract<ExecuteParams, { action: "approuver" | "rejeter" | "retirer" }>
  ) {
    const { action, demandeId, actor } = params

    const demande = await this.db.demandeDeplacement.findUnique({
      where: { id: demandeId },
      include: { employe: { select: { id: true, prenom: true, nom: true } } },
    })
    if (!demande || demande.deletedAt) throw new DemandeNotFoundError()

    const { etape } = fromLegacyStatus(demande.statut)

    if (action === "retirer" && demande.employeId !== actor.id) {
      throw new UnauthorizedActionError("Seul le proprietaire peut retirer la demande")
    }

    if (!canTransition(actor.role, etape, action as WorkflowAction)) {
      throw new UnauthorizedActionError()
    }

    const transitionParams: { comment?: string; assigneAId?: string } = {}
    if (action === "approuver") {
      transitionParams.assigneAId = actor.id
      if (params.comment) transitionParams.comment = params.comment
    }
    if (action === "rejeter") {
      transitionParams.comment = params.comment
    }

    const transition = buildTransition(
      actor.role,
      etape,
      action as WorkflowAction,
      transitionParams
    )
    if (!transition) throw new InvalidTransitionError()

    const updated = await this.db.demandeDeplacement.update({
      where: { id: demandeId },
      data: transition.transition.fields as Prisma.DemandeDeplacementUncheckedUpdateInput,
    })

    await this.audit.log({
      utilisateurId: actor.id,
      action: transition.auditAction,
      entite: "DemandeDeplacement",
      entiteId: demandeId,
      details: { numero: demande.numero },
    })

    const notificationPayload: NotificationPayload = {
      demandeId: demande.id,
      numero: demande.numero,
      employe: {
        id: demande.employe.id,
        prenom: demande.employe.prenom,
        nom: demande.employe.nom,
      },
    }

    if (action === "retirer") {
      notificationPayload.assigneAId = demande.assigneAId
    }

    await this.notifications.dispatch(
      transition.notificationEvent,
      notificationPayload
    )

    return { demande: updated }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private processMotif(motif: string[], motifAutre?: string): string[] {
    const arr = [...motif]
    if (arr.includes("autre") && motifAutre) {
      const idx = arr.indexOf("autre")
      arr[idx] = `Autre: ${motifAutre}`
    }
    return arr
  }

  private computeTotalEstime(data: CreateDemandeData): number {
    return (
      this.parseDecimal(data.fraisTransport) +
      this.parseDecimal(data.fraisHebergement) +
      this.parseDecimal(data.fraisRepas) +
      this.parseDecimal(data.fraisDivers)
    )
  }

  private parseDecimal(value?: string): number {
    return parseFloat(value || "0")
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const demandeService = new DemandeDeplacementService(prisma)
