import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole, type Role } from "@/lib/auth/server"
import { findAllForExport } from "@/lib/demande"
import { handleServiceError } from "@/lib/errors"

const EXPORT_ROLES: Role[] = ["FINANCE_ADMIN", "GENERAL_DIRECTION"]

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const authorized = requireAnyRole(auth.user, EXPORT_ROLES)
  if (!authorized.ok) return authorized.response

  let demandes
  try {
    demandes = await findAllForExport()
  } catch (e) {
    return handleServiceError(e)
  }

  const header =
    "Numero,Employe,Destination,DateDepart,DateRetour,Transport,Total,Statut,CreeLe\n"
  const rows = demandes
    .map(
      (d) =>
        `"${d.numero}","${d.employe ? `${d.employe.prenom} ${d.employe.nom}` : ""}","${d.destination}","${d.dateDepart.toISOString().split("T")[0]}","${d.dateRetour.toISOString().split("T")[0]}","${d.typeTransport}","${d.totalEstime ?? 0}","${d.etape}","${d.creeLe.toISOString()}"`
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
