import { db } from "../db"
import { societes } from "../db/schema/societes"
import { loadSocieteIdentity } from "./societe-identity"

export interface SocieteBranding {
  id: string
  nom: string
  logoUrl: string | null
  faviconUrl: string | null
  couleurPrimaire: string | null
  nomExpediteurEmail: string | null
  domaineEmail: string | null
}

export async function getSocieteBranding(): Promise<SocieteBranding | null> {
  try {
    const [result] = await db
      .select({ id: societes.id, nom: societes.nom, logoUrl: societes.logoUrl, faviconUrl: societes.faviconUrl, couleurPrimaire: societes.couleurPrimaire })
      .from(societes)
      .limit(1)

    if (!result) return null

    const identity = await loadSocieteIdentity()

    return {
      ...result,
      nomExpediteurEmail: identity.nomExpediteurEmail,
      domaineEmail: identity.domaineEmail,
    }
  } catch {
    return null
  }
}