import { eq, count } from "drizzle-orm"
import { db } from "../../db"
import { demandesDeplacement } from "../../db/schema/demandes-deplacement"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { departements } from "../../db/schema/departements"
import { documents } from "../../db/schema/documents"
import type { CreateDemandeData } from "../demande-utils"
import type { Actor } from "../demande-types"
import { checkTransition, buildTransition } from "../workflow"
import type { Etape, Decision } from "../workflow"
import type { NotificationEventType } from "../notification-events"
import { appliquerEffets } from "./effets-transition"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "../errors"

export type DemandeDeplacementRow = typeof demandesDeplacement.$inferSelect
export type DocumentRow = typeof documents.$inferSelect

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
  const [result] = await db.select({ value: count() }).from(demandesDeplacement)
  const nextNum = (result?.value ?? 0) + 1
  return `DD-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`
}

async function createDemande(
  data: CreateDemandeData,
  actor: Actor,
  submit: boolean
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

  const [demande] = await db.transaction(async (tx) => {
    const [demande] = await tx
      .insert(demandesDeplacement)
      .values(createValues as never)
      .returning()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await appliquerEffets(tx as any, {
      audit: {
        utilisateurId: userRow.id,
        action: auditAction,
        entiteId: demande.id,
        numero,
      },
      notification: notificationEvent
        ? {
            event: notificationEvent,
            demandeId: demande.id,
            numero,
            employe: {
              id: userRow.id,
              prenom: userRow.prenom,
              nom: userRow.nom,
              departementId: userRow.departementId ?? "",
            },
            assigneAId: null,
          }
        : null,
    })

    return [demande]
  })

  return demande
}

export async function createDraft(
  data: CreateDemandeData,
  actor: Actor
): Promise<DemandeDeplacementRow> {
  return createDemande(data, actor, false)
}

export async function createAndSubmit(
  data: CreateDemandeData,
  actor: Actor
): Promise<DemandeDeplacementRow> {
  return createDemande(data, actor, true)
}

export async function executeTransition(
  params: ExecuteTransitionParams
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

  const ownerMatch = demande.employeId === actor.id
  const check = checkTransition(actor.role, etape, action, decision, ownerMatch)
  if (!check.ok) {
    if (check.reason === "NOT_OWNER") {
      throw new UnauthorizedActionError(
        "Seul le proprietaire peut " +
          (action === "submit" ? "soumettre" : "retirer") +
          " la demande"
      )
    }
    throw new UnauthorizedActionError()
  }

  const transitionParams: {
    comment?: string
    actorId?: string
    decision?: Decision
  } = { actorId: actor.id, decision }
  if (params.comment) transitionParams.comment = params.comment

  const transition = buildTransition(
    actor.role,
    etape,
    action,
    transitionParams
  )
  if (!transition) throw new InvalidTransitionError()

  const fields = { ...transition.transition.fields, modifieLe: new Date() }

  const [updated] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(demandesDeplacement)
      .set(fields)
      .where(eq(demandesDeplacement.id, demandeId))
      .returning()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await appliquerEffets(tx as any, {
      audit: {
        utilisateurId: actor.id,
        action: transition.auditAction,
        entiteId: demandeId,
        numero: demande.numero,
      },
      notification: {
        event: transition.notificationEvent,
        demandeId,
        numero: demande.numero,
        employe: {
          id: demande.employe?.id ?? actor.id,
          prenom: demande.employe?.prenom ?? "",
          nom: demande.employe?.nom ?? "",
          departementId: demande.employe?.departementId ?? "",
        },
        assigneAId: demande.assigneAId,
      },
    })

    return [updated]
  })

  return updated
}

export async function recordDocument(
  demandeId: string,
  params: { type: string; chemin: string }
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
