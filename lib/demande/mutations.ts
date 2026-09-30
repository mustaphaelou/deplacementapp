import { eq, count } from "drizzle-orm"
import { db } from "../../db"
import { demandesDeplacement } from "../../db/schema/demandes-deplacement"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { departements } from "../../db/schema/departements"
import { documents } from "../../db/schema/documents"
import type { CreateDemandeData } from "../demande-utils"
import type { Actor } from "../demande-types"
import { resoudreTransition, etatCreation } from "../workflow"
import type { NotificationEventType } from "../notification-events"
import { appliquerEffets } from "./effets-transition"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  NumeroCollisionError,
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

/**
 * Postgres SQLSTATE for a unique violation, on the unique index
 * `demandes_deplacement_numero_index` that guards the numéro. Drizzle wraps
 * the driver error in a `DrizzleQueryError` and keeps the driver error — the
 * one carrying `code`/`constraint` — as its `cause`, so the chain is walked.
 * Matching the code alone is deliberate: only the numéro insert can raise it
 * inside this transaction, and a broader match would swallow an unrelated
 * database failure into a refusal that does not describe it.
 */
function isNumeroUniqueViolation(e: unknown): boolean {
  for (let cause: unknown = e; cause; cause = (cause as Error).cause) {
    if ((cause as { code?: unknown }).code === "23505") return true
  }
  return false
}

/**
 * The counter feeds a global count and a year prefix read from the clock, so
 * two creations that interleave can read the same count and write the same
 * numéro. The database then refuses the second one — a lost race, not a bad
 * form — so the creation is tried again, this many times at most. Past the
 * bound the Utilisateur is refused with the collision's own sentence and
 * status (`NumeroCollisionError`), which is the refusal #291 made legible
 * (#292).
 */
const NUMERO_COLLISION_ATTEMPTS = 3

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

  const motifArray = processMotif(data.motif, data.motifAutre)
  const totalEstime = computeTotalEstime(data)

  // The pipeline owns where a DemandeDeplacement is born: this one call
  // answers the Etape, the Decision, the fields to write, the JournalAudit
  // action and the Notification event, for a draft and for a submission
  // alike. There is no Etape or Decision literal here, and no branch that
  // reconciles a first value with a second (#293).
  const etat = etatCreation(actor.role, submit)
  const auditAction: string = etat.auditAction
  const notificationEvent: NotificationEventType | null = etat.notification

  // #292: the bound wraps the WHOLE creation, not the insert. Once a
  // statement fails inside a transaction, that transaction is poisoned —
  // every later statement in it is refused until it ends — so a retry
  // attempted inside the same transaction cannot succeed. So the loop below
  // holds the read of the counter, the transaction, the row, the JournalAudit
  // entry and the Notification, and each attempt re-reads the counter: a
  // retry that reused the previous attempt's numéro would collide again on
  // the very same index.
  for (
    let tentative = 1;
    tentative <= NUMERO_COLLISION_ATTEMPTS;
    tentative++
  ) {
    const numero = await generateNumero()

    const createValues: Record<string, unknown> = {
      id: crypto.randomUUID(),
      numero,
      employeId: userRow.id,
      ...etat.champs,
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

    try {
      const [demande] = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(demandesDeplacement)
          .values(createValues as never)
          .returning()

        await appliquerEffets(tx, {
          audit: {
            utilisateurId: userRow.id,
            action: auditAction,
            entiteId: created.id,
            numero,
          },
          notification: notificationEvent
            ? {
                event: notificationEvent,
                demandeId: created.id,
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

        return [created]
      })

      return demande
    } catch (e) {
      // The transaction has rolled back and ended here; it holds nothing of
      // the failed attempt. Anything else is not a numbering collision and
      // reaches the caller as itself.
      if (!isNumeroUniqueViolation(e)) throw e
      if (tentative === NUMERO_COLLISION_ATTEMPTS) throw new NumeroCollisionError()
    }
  }

  // Unreachable: the last attempt either returns its DemandeDeplacement or
  // refuses with the collision above. Written so every path returns.
  throw new NumeroCollisionError()
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

  // No cast: the row's `etape` / `decision` are the pipeline's unions, read
  // off a native pgEnum column through the schema's inferred row (#295).
  const etape = demande.etape
  const decision = demande.decision

  const ownerMatch = demande.employeId === actor.id

  // One call into the guard, asked with the real ownership fact: the actor
  // either is the DemandeDeplacement's employee or is not, and the row says
  // which. The old path asked here and then asked again inside the builder
  // with ownership hardcoded to « yes », so a caller could reach a transition
  // for an action it had no ownership of without ever saying so (#299).
  const resolution = resoudreTransition(actor.role, etape, action, {
    decision,
    ownerMatch,
    comment: params.comment,
    actorId: actor.id,
  })
  if (!resolution.ok) {
    if (resolution.reason === "NOT_OWNER") {
      throw new UnauthorizedActionError(
        "Seul le proprietaire peut " +
          (action === "submit" ? "soumettre" : "retirer") +
          " la demande"
      )
    }
    throw new UnauthorizedActionError()
  }

  const transition = resolution.transition

  const fields = { ...transition.transition.fields, modifieLe: new Date() }

  const [updated] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(demandesDeplacement)
      .set(fields)
      .where(eq(demandesDeplacement.id, demandeId))
      .returning()

    await appliquerEffets(tx, {
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
