import { prisma } from "@/lib/prisma"

export async function creerNotification(
  utilisateurId: string,
  titre: string,
  message: string,
  demandeId?: string
) {
  return prisma.notification.create({
    data: {
      utilisateurId,
      titre,
      message,
      demandeId,
    },
  })
}

export async function notifyOnSubmit(demande: { id: string; employe: { prenom: string; nom: string } }) {
  const managers = await prisma.utilisateur.findMany({
    where: { role: "MANAGER", actif: true },
  })
  for (const m of managers) {
    await creerNotification(
      m.id,
      "Nouvelle demande de déplacement",
      `${demande.employe.prenom} ${demande.employe.nom} a soumis une demande de déplacement.`,
      demande.id
    )
  }
}

export async function notifyOnManagerApprove(demande: { id: string; numero: string; employe: { prenom: string; nom: string } }) {
  const finance = await prisma.utilisateur.findMany({
    where: { role: "FINANCE_ADMIN", actif: true },
  })
  for (const f of finance) {
    await creerNotification(
      f.id,
      "Demande approuvée par le manager",
      `La demande ${demande.numero} de ${demande.employe.prenom} ${demande.employe.nom} a été approuvée par le manager.`,
      demande.id
    )
  }
}

export async function notifyOnFinanceApprove(demande: { id: string; numero: string; employe: { prenom: string; nom: string } }) {
  const direction = await prisma.utilisateur.findMany({
    where: { role: "GENERAL_DIRECTION", actif: true },
  })
  for (const d of direction) {
    await creerNotification(
      d.id,
      "Demande approuvée par les finances",
      `La demande ${demande.numero} de ${demande.employe.prenom} ${demande.employe.nom} est en attente d'approbation finale.`,
      demande.id
    )
  }
}

export async function notifyOnReject(demande: { id: string; employeId: string }) {
  await creerNotification(
    demande.employeId,
    "Demande rejetée",
    "Votre demande de déplacement a été rejetée. Consultez les commentaires pour plus de détails.",
    demande.id
  )
}

export async function notifyOnFinalApprove(demande: { id: string; employeId: string; numero: string }) {
  await creerNotification(
    demande.employeId,
    "Demande approuvée",
    `Votre demande ${demande.numero} a été approuvée.`,
    demande.id
  )
}

export async function notifyOnWithdraw(demande: { id: string; assigneAId?: string | null; numero: string; employe: { prenom: string; nom: string } }) {
  if (demande.assigneAId) {
    await creerNotification(
      demande.assigneAId,
      "Demande retirée",
      `${demande.employe.prenom} ${demande.employe.nom} a retiré la demande ${demande.numero}.`,
      demande.id
    )
  }
}
