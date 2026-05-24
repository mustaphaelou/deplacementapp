import { describe, it, expect } from "vitest"

async function getSchemas() {
  return import("@/lib/schemas")
}

describe("demandeSchema", () => {
  it("validates a valid demande payload", async () => {
    const { demandeSchema } = await getSchemas()
    const result = demandeSchema.safeParse({
      motif: ["mission"],
      dateDepart: "2026-06-01",
      dateRetour: "2026-06-05",
      destination: "Paris",
      typeTransport: "AVION",
      avanceRequise: false,
    })

    expect(result.success).toBe(true)
  })

  it("rejects dateRetour before dateDepart", async () => {
    const { demandeSchema } = await getSchemas()
    const result = demandeSchema.safeParse({
      motif: ["mission"],
      dateDepart: "2026-06-10",
      dateRetour: "2026-06-05",
      destination: "Paris",
      typeTransport: "AVION",
    })

    expect(result.success).toBe(false)
  })

  it("strips unknown fields like action", async () => {
    const { demandeSchema } = await getSchemas()
    const result = demandeSchema.safeParse({
      motif: ["mission"],
      dateDepart: "2026-06-01",
      dateRetour: "2026-06-05",
      destination: "Paris",
      typeTransport: "AVION",
      avanceRequise: false,
      action: "submit",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe("submit")
    }
  })
})

describe("passwordChangeSchema", () => {
  it("accepts valid password change body", async () => {
    const { passwordChangeSchema } = await getSchemas()
    const result = passwordChangeSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "newpass123",
    })

    expect(result.success).toBe(true)
  })

  it("rejects missing currentPassword", async () => {
    const { passwordChangeSchema } = await getSchemas()
    const result = passwordChangeSchema.safeParse({ newPassword: "newpass123" })

    expect(result.success).toBe(false)
  })

  it("rejects newPassword shorter than 6 characters", async () => {
    const { passwordChangeSchema } = await getSchemas()
    const result = passwordChangeSchema.safeParse({
      currentPassword: "oldpass",
      newPassword: "abc",
    })

    expect(result.success).toBe(false)
  })
})

describe("deleteVehiculeSchema", () => {
  it("accepts valid id", async () => {
    const { deleteVehiculeSchema } = await getSchemas()
    const result = deleteVehiculeSchema.safeParse({ id: "v-1" })
    expect(result.success).toBe(true)
  })

  it("rejects missing id", async () => {
    const { deleteVehiculeSchema } = await getSchemas()
    const result = deleteVehiculeSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("updateVehiculeSchema", () => {
  it("accepts valid update body", async () => {
    const { updateVehiculeSchema } = await getSchemas()
    const result = updateVehiculeSchema.safeParse({
      id: "v-1",
      nom: "Clio",
      immatriculation: "AB-123-CD",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing id", async () => {
    const { updateVehiculeSchema } = await getSchemas()
    const result = updateVehiculeSchema.safeParse({
      nom: "Clio",
      immatriculation: "AB-123-CD",
    })
    expect(result.success).toBe(false)
  })
})

describe("updateUtilisateurSchema", () => {
  it("accepts valid update body with id", async () => {
    const { updateUtilisateurSchema } = await getSchemas()
    const result = updateUtilisateurSchema.safeParse({
      id: "u-1",
      email: "a@b.com",
      nom: "Dupont",
      prenom: "Jean",
      poste: "Dev",
      role: "EMPLOYEE",
      departementId: "dep-1",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing id", async () => {
    const { updateUtilisateurSchema } = await getSchemas()
    const result = updateUtilisateurSchema.safeParse({
      email: "a@b.com",
      nom: "Dupont",
      prenom: "Jean",
      poste: "Dev",
      role: "EMPLOYEE",
      departementId: "dep-1",
    })
    expect(result.success).toBe(false)
  })
})

describe("profilUpdateSchema", () => {
  it("accepts empty body (all optional)", async () => {
    const { profilUpdateSchema } = await getSchemas()
    const result = profilUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts valid email", async () => {
    const { profilUpdateSchema } = await getSchemas()
    const result = profilUpdateSchema.safeParse({ email: "new@b.com" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", async () => {
    const { profilUpdateSchema } = await getSchemas()
    const result = profilUpdateSchema.safeParse({ email: "bad" })
    expect(result.success).toBe(false)
  })
})



describe("actionBodySchema", () => {
  it("accepts approuver without comment", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "approuver" })

    expect(result.success).toBe(true)
  })

  it("accepts approuver with comment", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "approuver", commentaire: "OK" })

    expect(result.success).toBe(true)
  })

  it("requires comment for rejeter", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "rejeter" })

    expect(result.success).toBe(false)
  })

  it("accepts rejeter with comment", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "rejeter", commentaire: "Pas valide" })

    expect(result.success).toBe(true)
  })

  it("accepts retirer without comment", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "retirer" })

    expect(result.success).toBe(true)
  })

  it("rejects unknown action", async () => {
    const { actionBodySchema } = await getSchemas()
    const result = actionBodySchema.safeParse({ action: "publier" })

    expect(result.success).toBe(false)
  })
})
