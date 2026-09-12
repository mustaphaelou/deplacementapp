import { describe, it, expect } from "vitest"
import { utilisateurSchema, updateUtilisateurSchema } from "@/lib/schemas"
import {
  buildUtilisateurPayload,
  type UtilisateurFormValues,
} from "./submit-payload"

// The exact shape the dialog's form state carries — no societeId: the service
// resolves the deployment's Societe behind the seam (ADR-0018).
const form: UtilisateurFormValues = {
  email: "user@example.com",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE",
  departementId: "d-1",
  telephone: "",
  motDePasse: "",
  googleAuthEnabled: false,
}

describe("buildUtilisateurPayload", () => {
  it("create payload passes the intake schema", () => {
    const payload = buildUtilisateurPayload(form)
    expect(payload).not.toHaveProperty("id")
    expect(utilisateurSchema.safeParse(payload).success).toBe(true)
  })

  it("edit payload passes the update schema", () => {
    const payload = buildUtilisateurPayload(form, "u-1")
    expect(payload).toMatchObject({ id: "u-1" })
    expect(updateUtilisateurSchema.safeParse(payload).success).toBe(true)
  })
})
