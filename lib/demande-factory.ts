import type { Prisma, PrismaClient, Role } from "@prisma/client"
import type { NotificationEventType, NotificationPayload } from "./notification-bus"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"
import type { CreateDemandeData } from "./demande-utils"
import { UnauthorizedActionError, InvalidTransitionError } from "./errors"
import { buildTransition } from "./workflow"
import {
  processMotif,
  computeTotalEstime,
  parseDecimal,
  notifyAndAudit,
} from "./demande-utils"

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

    const motifArray = processMotif(data.motif, data.motifAutre)
    const totalEstime = computeTotalEstime(data)

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
      fraisTransport: parseDecimal(data.fraisTransport),
      fraisHebergement: parseDecimal(data.fraisHebergement),
      fraisRepas: parseDecimal(data.fraisRepas),
      fraisDivers: parseDecimal(data.fraisDivers),
      totalEstime,
      avanceRequise: data.avanceRequise || false,
      montantAvance: data.avanceRequise ? parseDecimal(data.montantAvance) : null,
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

    await notifyAndAudit({
      audit: this.audit,
      notifications: this.notifications,
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
