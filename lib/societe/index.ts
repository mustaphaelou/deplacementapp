import { eq } from "drizzle-orm"
import type { DrizzleDb, DrizzleTransactionClient } from "../../db"
import { db } from "../../db"
import { societes } from "../../db/schema/societes"
import { logAudit } from "../audit"
import { AUCUNE_SOCIETE_CONFIGUREE } from "../errors"
import type { SocieteUpdate } from "../schemas"

let cachedIdentity: SocieteIdentity | null = null
let warnedIdentityOnce = false
let warnedBrandingOnce = false

export interface SocieteIdentity {
  nomExpediteurEmail: string
  domaineEmail: string
}

/** Visual identity fields of the Societe (see IdentiteVisuelle in CONTEXT.md). */
export interface SocieteBranding {
  id: string
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
}

export async function getSocieteBranding(
  dbArg: DrizzleDb = db
): Promise<SocieteBranding | null> {
  try {
    const [result] = await dbArg
      .select({
        id: societes.id,
        nom: societes.nom,
        logoUrl: societes.logoUrl,
        faviconUrl: societes.faviconUrl,
        couleurPrimaire: societes.couleurPrimaire,
      })
      .from(societes)
      .limit(1)

    return result ?? null
  } catch {
    if (!warnedBrandingOnce) {
      console.warn("[SocieteBranding] Database unreachable — returning null")
      warnedBrandingOnce = true
    }
    return null
  }
}

export async function loadSocieteIdentity(
  dbArg: DrizzleDb = db
): Promise<SocieteIdentity> {
  if (cachedIdentity) return cachedIdentity

  try {
    const [result] = await dbArg.select().from(societes).limit(1)

    if (result?.nomExpediteurEmail && result?.domaineEmail) {
      cachedIdentity = {
        nomExpediteurEmail: result.nomExpediteurEmail,
        domaineEmail: `noreply@${result.domaineEmail}`,
      }
      return cachedIdentity
    }

    return getEnvFallback()
  } catch {
    if (!warnedIdentityOnce) {
      console.warn(
        "[SocieteIdentity] Database unreachable — using SMTP env fallback"
      )
      warnedIdentityOnce = true
    }
    return getEnvFallback()
  }
}

function getEnvFallback(): SocieteIdentity {
  cachedIdentity = {
    nomExpediteurEmail: process.env.SMTP_FROM_NAME ?? "Notification",
    domaineEmail: process.env.SMTP_FROM ?? "noreply@exemple.ma",
  }
  return cachedIdentity
}

export function clearSocieteCache(): void {
  cachedIdentity = null
  warnedIdentityOnce = false
  warnedBrandingOnce = false
}

/**
 * Raw Societe row reader for the authenticated management surface and
 * Utilisateur provisioning (ADR-0012: the composed `noreply@<domain>` identity
 * stays inside loadSocieteIdentity; readers need the stored column values).
 * Accepts a transaction client so provisioning can resolve the deployment's
 * Societe inside its own transaction (ADR-0018).
 */
export async function getSocieteRow(
  dbArg: DrizzleTransactionClient = db
): Promise<
  | (SocieteBranding & {
      nomExpediteurEmail: string | null
      domaineEmail: string | null
    })
  | null
> {
  const [row] = await dbArg.select().from(societes).limit(1)
  if (!row) return null
  return {
    id: row.id,
    nom: row.nom,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    couleurPrimaire: row.couleurPrimaire,
    nomExpediteurEmail: row.nomExpediteurEmail,
    domaineEmail: row.domaineEmail,
  }
}

/**
 * Mutation writer for the Societe (ADR-0012): the row write and the
 * JournalAudit entry run inside one `db.transaction` — JournalAudit records
 * *committed* state changes — and the in-memory identity cache is cleared
 * only after the transaction commits.
 */
export async function updateSociete(
  changes: SocieteUpdate,
  actorId: string,
  dbArg: DrizzleDb = db
): Promise<SocieteUpdate> {
  const [societe] = await dbArg.select().from(societes).limit(1)
  if (!societe) {
    throw new Error(AUCUNE_SOCIETE_CONFIGUREE)
  }

  // Primary validation lives in societeUpdateSchema (route layer); this
  // defensive check keeps the writer from issuing an empty UPDATE.
  const cleanChanges: SocieteUpdate = { ...changes }
  if (Object.keys(cleanChanges).length === 0) {
    throw new Error("Aucune donnée à mettre à jour")
  }

  await dbArg.transaction(async (tx) => {
    await tx
      .update(societes)
      .set(cleanChanges)
      .where(eq(societes.id, societe.id))

    await logAudit(
      {
        utilisateurId: actorId,
        action: "MODIFIER_SOCIETE",
        entite: "Societe",
        entiteId: societe.id,
        details: { changes: Object.keys(cleanChanges) },
      },
      tx
    )
  })

  clearSocieteCache()

  return cleanChanges
}
