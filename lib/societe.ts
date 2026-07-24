import { prisma } from "@/lib/prisma"

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
    return await prisma.societe.findFirst()
  } catch {
    return null
  }
}