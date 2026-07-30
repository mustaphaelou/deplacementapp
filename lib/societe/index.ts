import { eq } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { db } from "../../db"
import { societes } from "../../db/schema/societes"
import { logAudit } from "../audit"

let cachedIdentity: SocieteIdentity | null = null
let warnedOnce = false

export interface SocieteIdentity {
  nomExpediteurEmail: string
  domaineEmail: string
}

export interface SocieteBranding {
  id: string
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
  nomExpediteurEmail: string | null
  domaineEmail: string | null
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

    if (!result) return null

    const identity = await loadSocieteIdentity(dbArg)

    return {
      ...result,
      nomExpediteurEmail: identity.nomExpediteurEmail,
      domaineEmail: identity.domaineEmail,
    }
  } catch {
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
    if (!warnedOnce) {
      console.warn(
        "[SocieteIdentity] Database unreachable — using SMTP env fallback"
      )
      warnedOnce = true
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
  warnedOnce = false
}

export async function updateSociete(
  changes: Record<string, unknown>,
  actorId: string,
  dbArg: DrizzleDb = db
): Promise<Record<string, unknown>> {
  const [societe] = await dbArg.select().from(societes).limit(1)
  if (!societe) {
    throw new Error("Aucune société configurée")
  }

  const allowed = [
    "nom",
    "logoUrl",
    "faviconUrl",
    "couleurPrimaire",
    "nomExpediteurEmail",
    "domaineEmail",
  ]
  const cleanChanges: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in changes) {
      cleanChanges[key] = changes[key]
    }
  }

  if (Object.keys(cleanChanges).length === 0) {
    throw new Error("Aucune donnée à mettre à jour")
  }

  await dbArg
    .update(societes)
    .set(cleanChanges)
    .where(eq(societes.id, societe.id))

  clearSocieteCache()

  await logAudit(
    {
      utilisateurId: actorId,
      action: "MODIFIER_SOCIETE",
      entite: "Societe",
      entiteId: societe.id,
      details: { changes: Object.keys(cleanChanges) },
    },
    dbArg
  )

  return cleanChanges
}
