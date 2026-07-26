import { eq, count } from "drizzle-orm"
import type { DrizzleDb, DrizzleTransactionClient } from "../../prisma"
import { utilisateurs } from "../../../db/schema/utilisateurs"
import { departements } from "../../../db/schema/departements"
import { demandesDeplacement } from "../../../db/schema/demandes-deplacement"
import type { DemandeFactoryPort } from "../ports/demande-factory-port"
import type { CreateDemandeData } from "../../demande-utils"
import type { Actor, DemandeWithRelations } from "../../demande-types"
import type { DemandeEventBus } from "../../demande-event-bus"
import type { NotificationEventType, NotificationPayload } from "../../notification-bus"
import { UnauthorizedActionError, InvalidTransitionError } from "../../errors"
import { buildTransition } from "../../workflow"

export class DemandeFactoryAdapter implements DemandeFactoryPort {
  constructor(
    private db: DrizzleDb,
    private events: DemandeEventBus
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

  async createDraft(
    data: CreateDemandeData,
    actor: Actor,
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }> {
    return this.createDemande(data, actor, false, tx)
  }

  async createAndSubmit(
    data: CreateDemandeData,
    actor: Actor,
    tx?: DrizzleTransactionClient
  ): Promise<{ demande: DemandeWithRelations }> {
    return this.createDemande(data, actor, true, tx)
  }

  private async createDemande(
    data: CreateDemandeData,
    actor: Actor,
    submit: boolean,
    tx?: DrizzleTransactionClient
  ) {
    const db = tx ?? this.db

    const [row] = await db
      .select({
        id: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        poste: utilisateurs.poste,
        departementId: utilisateurs.departementId,
        departementNom: departements.nom,
      })
      .from(utilisateurs)
      .leftJoin(departements, eq(utilisateurs.departementId, departements.id))
      .where(eq(utilisateurs.id, actor.id))
      .limit(1)
    if (!row) throw new UnauthorizedActionError("Utilisateur introuvable")
    const user = row

    const countResult = await db
      .select({ value: count() })
      .from(demandesDeplacement)
    const nextNum = (countResult[0]?.value ?? 0) + 1
    const numero = `DD-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`

    const motifArray = this.processMotif(data.motif, data.motifAutre)
    const totalEstime = this.computeTotalEstime(data)

    const createData: Record<string, unknown> = {
      numero,
      employeId: user.id,
      statut: "BROUILLON",
      employeNom: user.nom,
      employePrenom: user.prenom,
      employePoste: user.poste,
      employeDepartement: user.departementNom ?? user.departementId,
      motif: JSON.stringify(motifArray),
      dateDepart: new Date(data.dateDepart),
      dateRetour: new Date(data.dateRetour),
      destination: data.destination,
      typeTransport: data.typeTransport,
      autreTransport: data.autreTransport || null,
      vehiculeId: data.vehiculeId || null,
      fraisTransport: this.parseDecimal(data.fraisTransport).toString(),
      fraisHebergement: this.parseDecimal(data.fraisHebergement).toString(),
      fraisRepas: this.parseDecimal(data.fraisRepas).toString(),
      fraisDivers: this.parseDecimal(data.fraisDivers).toString(),
      totalEstime: totalEstime.toString(),
      avanceRequise: data.avanceRequise || false,
      montantAvance: data.avanceRequise ? this.parseDecimal(data.montantAvance).toString() : null,
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
        employe: {
          id: user.id,
          prenom: user.prenom,
          nom: user.nom,
          departementId: user.departementId,
        },
      }
    }

    const [demande] = await db
      .insert(demandesDeplacement)
      .values({ id: crypto.randomUUID(), ...createData } as never)
      .returning()

    await this.events.dispatch({
      utilisateurId: user.id,
      action: auditAction,
      entiteId: demande.id,
      numero,
      notificationEvent,
      notificationPayload,
    })

    return { demande: demande as unknown as DemandeWithRelations }
  }
}