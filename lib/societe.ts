import { db } from "../db"
import { societes } from "../db/schema/societes"

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
    const [result] = await db.select().from(societes).limit(1)
    return result ?? null
  } catch {
    return null
  }
}