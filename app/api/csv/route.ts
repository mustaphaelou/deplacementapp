import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "FINANCE_ADMIN" && session.user.role !== "GENERAL_DIRECTION")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const demandes = await prisma.demandeDeplacement.findMany({
    where: { deletedAt: null },
    orderBy: { creeLe: "desc" },
    include: {
      employe: { select: { prenom: true, nom: true } },
    },
  })

  const header = "Numero,Employe,Destination,DateDepart,DateRetour,Transport,Total,Statut,CreeLe\n"
  const rows = demandes
    .map(
      (d) =>
        `"${d.numero}","${d.employe.prenom} ${d.employe.nom}","${d.destination}","${d.dateDepart.toISOString().split("T")[0]}","${d.dateRetour.toISOString().split("T")[0]}","${d.typeTransport}","${d.totalEstime ?? 0}","${d.statut}","${d.creeLe.toISOString()}"`
    )
    .join("\n")

  const csv = `\uFEFF${header}${rows}`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="demandes-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
