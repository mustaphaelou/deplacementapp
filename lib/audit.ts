import { prisma } from "@/lib/prisma"

export async function ajouterAudit(
  utilisateurId: string,
  action: string,
  entite: string,
  entiteId?: string,
  details?: Record<string, unknown>
) {
  return prisma.journalAudit.create({
    data: {
      utilisateurId,
      action,
      entite,
      entiteId,
      details: details ? JSON.stringify(details) : null,
    },
  })
}
