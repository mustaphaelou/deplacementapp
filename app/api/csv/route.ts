import { NextResponse } from "next/server"
import { requireAuth, requireAnyRole, type Role } from "@/lib/auth/server"
import { findAllForExport } from "@/lib/demande"
import { toDemandeDocumentView } from "@/lib/demande-presentation"
import { handleServiceError } from "@/lib/errors"

// CSV formula-injection sink guard (OWASP): spreadsheet apps evaluate cells
// starting with = + - @ (plus tab/CR) as formulas. Attacker-controlled
// free-text (e.g. horsMaroc destination bypassing the city allowlist) flows
// raw into this finance-only export, so neutralize at the sink: after any
// leading spaces, a trigger first-char gets a single-quote prefix which
// forces inert-text interpretation. Embedded quotes are doubled per RFC 4180.
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value)
  if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

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
    .map((d) => {
      const view = toDemandeDocumentView(d)
      return [
        d.numero,
        d.employe ? `${d.employe.prenom} ${d.employe.nom}` : "",
        d.destination,
        d.dateDepart.toISOString().split("T")[0],
        d.dateRetour.toISOString().split("T")[0],
        view.transport,
        d.totalEstime ?? 0,
        view.presentation.compactLabel,
        d.creeLe.toISOString(),
      ]
        .map(csvCell)
        .join(",")
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
