import { NextResponse } from "next/server"
import { executeTransition } from "@/lib/demande"
import { actionBodySchema } from "@/lib/schemas"
import { withValidation } from "@/lib/api-utils"
import { handleServiceError } from "@/lib/errors"

/**
 * The transition route. Its REFUSALS changed shape in #300, and this docblock is
 * the copy a client author can actually read — the note in `lib/errors.ts` is not,
 * because that module imports `next/server` and never reaches a client bundle.
 *
 * The codes: two reasons now answer 422 instead of 403 — `TERMINAL` (the Decision
 * is already recorded) and `NO_EFFECT` (the action does not exist at this Etape) —
 * while `WRONG_ROLE` and `NOT_OWNER` keep 403. 403 means « you may not », 422 means
 * invalid transition: do not assume every refusal here is a permission failure.
 * `REFUS_TRANSITION` in `lib/errors.ts` is the source; read the table there, not a
 * summary of it.
 *
 * The only in-repo client of this route, `hooks/use-demande-actions.ts`, reads
 * `data.error` and ignores the status code (`!res.ok` is its whole check), so
 * nothing in this repository had to change. A client written later may branch on
 * the code, and must then branch on both numbers.
 */
export const POST = withValidation(
  actionBodySchema,
  async (req, auth, data, params: { id: string }) => {
    const { id } = params

    try {
      let comment: string | undefined
      if (data.action === "retirer") {
        comment = undefined
      } else if (data.action === "rejeter") {
        comment = data.commentaire
      } else {
        comment = data.commentaire?.trim()
      }
      const demande = await executeTransition({
        demandeId: id,
        action: data.action,
        actor: { id: auth.id, role: auth.role },
        comment,
      })
      return NextResponse.json({ demande })
    } catch (e) {
      return handleServiceError(e)
    }
  }
)
