import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole } from "@/lib/auth/server"
import { ROLES_MANAGEMENT } from "@/lib/auth/roles"
import { findAllForExport } from "@/lib/demande"
import { toDemandeDocumentView } from "@/lib/demande-presentation"
import { handleServiceError } from "@/lib/errors"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const authorized = requireAnyRole(auth.user, ROLES_MANAGEMENT)
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
    .map((d) => {
      const view = toDemandeDocumentView(d)
      return `"${d.numero}","${d.employe ? `${d.employe.prenom} ${d.employe.nom}` : ""}","${d.destination}","${d.dateDepart.toISOString().split("T")[0]}","${d.dateRetour.toISOString().split("T")[0]}","${view.transport}","${d.totalEstime ?? 0}","${view.presentation.compactLabel}","${d.creeLe.toISOString()}"`
    })
    .join("\n")

  const csv = `\uFEFF${header}${rows}`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="demandes-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
