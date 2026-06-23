import type { Prisma, PrismaClient, Role } from "@prisma/client"
import type { NotificationEventType, NotificationPayload } from "./notification-bus"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import type { CreateDemandeData } from "./demande-utils"
import { UnauthorizedActionError, InvalidTransitionError } from "./errors"
import { buildTransition } from "./workflow"

export interface Actor {
  id: string
  role: Role
}

export class DemandeFactory {
  constructor(
    private db: PrismaClient,
    private notifications: NotificationBus,
    private audit: AuditBus
  ) {}

  private parseDecimal(value?: string): number {
    return parseFloat(value || "0")
  }

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

  private async notifyAndAudit(params: {
    utilisateurId: string
    action: string
    entiteId: string
    numero: string
    notificationEvent?: NotificationEventType | null
    notificationPayload?: Omit<NotificationPayload, "demandeId" | "numero"> | null
  }) {
    await this.audit.log({
      utilisateurId: params.utilisateurId,
      action: params.action,
      entite: "DemandeDeplacement",
      entiteId: params.entiteId,
      details: { numero: params.numero },
    })

    if (params.notificationEvent && params.notificationPayload) {
      await this.notifications.dispatch(params.notificationEvent, {
        demandeId: params.entiteId,
        numero: params.numero,
        ...params.notificationPayload,
      })
    }
  }

  async createDraft(data: CreateDemandeData, actor: Actor) {
    return this.createDemande(data, actor, false)
  }

  async createAndSubmit(data: CreateDemandeData, actor: Actor) {
    return this.createDemande(data, actor, true)
  }

  private async createDemande(
    data: CreateDemandeData,
    actor: Actor,
    submit: boolean
  ) {
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
    let notificationPayload: Omit<NotificationPayload, "demandeId" | "numero"> | null = null

    if (submit) {
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

    await this.notifyAndAudit({
      utilisateurId: user.id,
      action: auditAction,
      entiteId: demande.id,
      numero,
      notificationEvent,
      notificationPayload,
    })

    return { demande }
  }
}
