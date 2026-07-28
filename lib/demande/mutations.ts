import { eq, and, count } from "drizzle-orm"
import { db } from "../../db"
import type { PgDatabase } from "drizzle-orm/pg-core"
import { demandesDeplacement } from "../../db/schema/demandes-deplacement"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { departements } from "../../db/schema/departements"
import { journalAudit } from "../../db/schema/journal-audit"
import { notifications } from "../../db/schema/notifications"
import { documents } from "../../db/schema/documents"
import type { CreateDemandeData } from "../demande-utils"
import type { Role } from "../roles"
import { canTransition, buildTransition } from "../workflow"
import type { Etape, Decision } from "../workflow"
import type { NotificationEventType } from "../notification-events"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "../errors"

export type DemandeDeplacementRow = typeof demandesDeplacement.$inferSelect
export type DocumentRow = typeof documents.$inferSelect

export interface Actor {
  id: string
  role: Role
}

export interface ExecuteTransitionParams {
  demandeId: string
  action: "submit" | "approuver" | "rejeter" | "retirer"
  actor: Actor
  comment?: string
}

function parseDecimal(value?: string): number {
  return parseFloat(value || "0")
}

function processMotif(motif: string[], motifAutre?: string): string[] {
  const arr = [...motif]
  if (arr.includes("autre") && motifAutre) {
    const idx = arr.indexOf("autre")
    arr[idx] = `Autre: ${motifAutre}`
  }
  return arr
}

function computeTotalEstime(data: CreateDemandeData): number {
  return (
    parseDecimal(data.fraisTransport) +
    parseDecimal(data.fraisHebergement) +
    parseDecimal(data.fraisRepas) +
    parseDecimal(data.fraisDivers)
  )
}

async function generateNumero(): Promise<string> {
  const [result] = await db
    .select({ value: count() })
    .from(demandesDeplacement)
  const nextNum = (result?.value ?? 0) + 1
  return `DD-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`
}

function buildMessage(
  event: NotificationEventType,
  numero: string,
  employePrenom: string,
  employeNom: string,
): { titre: string; message: string } {
  const fullName = `${employePrenom} ${employeNom}`
  switch (event) {
    case "DEMANDE_SOUMISE":
      return {
        titre: "Nouvelle demande de déplacement",
        message: `${fullName} a soumis une demande de déplacement.`,
      }
    case "DEMANDE_APPROBATION_MANAGER":
      return {
        titre: "Demande approuvée par le manager",
        message: `La demande ${numero} de ${fullName} a été approuvée par le manager.`,
      }
    case "DEMANDE_APPROBATION_FINANCE":
      return {
        titre: "Demande approuvée par les finances",
        message: `La demande ${numero} de ${fullName} est en attente d'approbation finale.`,
      }
    case "DEMANDE_APPROBATION_FINALE":
      return {
        titre: "Demande approuvée",
        message: `Votre demande ${numero} a été approuvée.`,
      }
    case "DEMANDE_REJETEE":
      return {
        titre: "Demande rejetée",
        message:
          "Votre demande de déplacement a été rejetée. Consultez les commentaires pour plus de détails.",
      }
    case "DEMANDE_RETIREE":
      return {
        titre: "Demande retirée",
        message: `${fullName} a retiré la demande ${numero}.`,
      }
    case "DEMANDE_NOTIFICATION_LUE":
      return {
        titre: "Notification lue",
        message: `La notification pour la demande ${numero} a été marquée comme lue.`,
      }
    default: {
      const _exhaustive: never = event
      throw new Error(`Unknown event type: ${_exhaustive}`)
    }
  }
}

async function writeJournalAudit(
  params: {
    utilisateurId: string
    action: string
    entiteId: string
    numero: string
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: PgDatabase<any, any, any>,
): Promise<void> {
  const client = tx ?? db
  await client.insert(journalAudit).values({
    id: crypto.randomUUID(),
    utilisateurId: params.utilisateurId,
    action: params.action,
    entite: "DemandeDeplacement",
    entiteId: params.entiteId,
    details: JSON.stringify({ numero: params.numero }),
  })
}

async function writeNotifications(
  params: {
    event: NotificationEventType
    demandeId: string
    numero: string
    employeeId: string
    employeePrenom: string
    employeeNom: string
    departementId: string
    assigneAId?: string | null
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: PgDatabase<any, any, any>,
): Promise<void> {
  const client = tx ?? db
  const { titre, message } = buildMessage(
    params.event,
    params.numero,
    params.employeePrenom,
    params.employeeNom,
  )
  const recipients = new Set<string>()

  if (params.event === "DEMANDE_SOUMISE") {
    const conditions = [eq(utilisateurs.role, "MANAGER")] as const
    const filter = params.departementId
      ? and(...conditions, eq(utilisateurs.departementId, params.departementId))
      : and(...conditions)
    const managers = await client
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(filter)
    managers.forEach((m) => recipients.add(m.id))
  } else if (params.event === "DEMANDE_APPROBATION_MANAGER") {
    const finance = await client
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.role, "FINANCE_ADMIN"))
    finance.forEach((f) => recipients.add(f.id))
  } else if (params.event === "DEMANDE_APPROBATION_FINANCE") {
    const direction = await client
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.role, "GENERAL_DIRECTION"))
    direction.forEach((d) => recipients.add(d.id))
  } else if (
    params.event === "DEMANDE_APPROBATION_FINALE" ||
    params.event === "DEMANDE_REJETEE"
  ) {
    recipients.add(params.employeeId)
  } else if (params.event === "DEMANDE_RETIREE" && params.assigneAId) {
    recipients.add(params.assigneAId)
  }

  if (recipients.size === 0) return

  await client.insert(notifications).values(
    Array.from(recipients).map((utilisateurId) => ({
      id: crypto.randomUUID(),
      utilisateurId,
      demandeId: params.demandeId,
      titre,
      message,
    })),
  )
}

async function createDemande(
  data: CreateDemandeData,
  actor: Actor,
  submit: boolean,
): Promise<DemandeDeplacementRow> {
  const [userRow] = await db
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
  if (!userRow) throw new UnauthorizedActionError("Utilisateur introuvable")

  const numero = await generateNumero()
  const motifArray = processMotif(data.motif, data.motifAutre)
  const totalEstime = computeTotalEstime(data)

  const createValues: Record<string, unknown> = {
    id: crypto.randomUUID(),
    numero,
    employeId: userRow.id,
    etape: "DRAFT",
    decision: "PENDING",
    employeNom: userRow.nom,
    employePrenom: userRow.prenom,
    employePoste: userRow.poste,
    employeDepartement: userRow.departementNom ?? userRow.departementId,
    motif: JSON.stringify(motifArray),
    dateDepart: new Date(data.dateDepart),
    dateRetour: new Date(data.dateRetour),
    destination: data.destination,
    typeTransport: data.typeTransport,
    autreTransport: data.autreTransport || null,
    vehiculeId: data.vehiculeId || null,
    fraisTransport: parseDecimal(data.fraisTransport).toString(),
    fraisHebergement: parseDecimal(data.fraisHebergement).toString(),
    fraisRepas: parseDecimal(data.fraisRepas).toString(),
    fraisDivers: parseDecimal(data.fraisDivers).toString(),
    totalEstime: totalEstime.toString(),
    avanceRequise: data.avanceRequise || false,
    montantAvance: data.avanceRequise
      ? parseDecimal(data.montantAvance).toString()
      : null,
    description: data.description || null,
    modifieLe: new Date(),
  }

  let auditAction = "CREATION"
  let notificationEvent: NotificationEventType | null = null

  if (submit) {
    const transition = buildTransition("EMPLOYEE", "DRAFT", "submit")
    if (!transition) throw new InvalidTransitionError("Soumission impossible")
    Object.assign(createValues, transition.transition.fields)
    createValues.modifieLe = new Date()
    auditAction = transition.auditAction
    notificationEvent = transition.notificationEvent
  }

  const [demande] = await db
    .insert(demandesDeplacement)
    .values(createValues as never)
    .returning()

  await writeJournalAudit({
    utilisateurId: userRow.id,
    action: auditAction,
    entiteId: demande.id,
    numero,
  })

  if (notificationEvent) {
    await writeNotifications({
      event: notificationEvent,
      demandeId: demande.id,
      numero,
      employeeId: userRow.id,
      employeePrenom: userRow.prenom,
      employeeNom: userRow.nom,
      departementId: userRow.departementId,
    })
  }

  return demande
}

export async function createDraft(
  data: CreateDemandeData,
  actor: Actor,
): Promise<DemandeDeplacementRow> {
  return createDemande(data, actor, false)
}

export async function createAndSubmit(
  data: CreateDemandeData,
  actor: Actor,
): Promise<DemandeDeplacementRow> {
  return createDemande(data, actor, true)
}

export async function executeTransition(
  params: ExecuteTransitionParams,
): Promise<DemandeDeplacementRow> {
  const { demandeId, action, actor } = params

  const demande = await db.query.demandesDeplacement.findFirst({
    where: eq(demandesDeplacement.id, demandeId),
    with: {
      employe: {
        columns: { id: true, prenom: true, nom: true, departementId: true },
      },
    },
  })
  if (!demande || demande.deletedAt) throw new DemandeNotFoundError()

  const etape = demande.etape as Etape
  const decision = demande.decision as Decision

  if (
    (action === "retirer" || action === "submit") &&
    demande.employeId !== actor.id
  ) {
    throw new UnauthorizedActionError(
      "Seul le proprietaire peut " +
        (action === "submit" ? "soumettre" : "retirer") +
        " la demande",
    )
  }

  if (!canTransition(actor.role, etape, action, decision)) {
    throw new UnauthorizedActionError()
  }

  const transitionParams: {
    comment?: string
    assigneAId?: string
    decision?: Decision
  } = { decision }
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
    action,
    transitionParams,
  )
  if (!transition) throw new InvalidTransitionError()

  const fields = { ...transition.transition.fields, modifieLe: new Date() }

  const [updated] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(demandesDeplacement)
      .set(fields)
      .where(eq(demandesDeplacement.id, demandeId))
      .returning()

    await writeJournalAudit(
      {
        utilisateurId: actor.id,
        action: transition.auditAction,
        entiteId: demandeId,
        numero: demande.numero,
      },
      tx,
    )

    await writeNotifications(
      {
        event: transition.notificationEvent,
        demandeId,
        numero: demande.numero,
        employeeId: demande.employe?.id ?? actor.id,
        employeePrenom: demande.employe?.prenom ?? "",
        employeeNom: demande.employe?.nom ?? "",
        departementId: demande.employe?.departementId ?? "",
        assigneAId: demande.assigneAId,
      },
      tx,
    )

    return [updated]
  })

  return updated
}

export async function recordDocument(
  demandeId: string,
  params: { type: string; chemin: string },
): Promise<DocumentRow> {
  const [doc] = await db
    .insert(documents)
    .values({
      id: crypto.randomUUID(),
      demandeId,
      type: params.type,
      chemin: params.chemin,
    })
    .returning()
  return doc
}
