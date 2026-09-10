import { describe, it, expect } from "vitest"
import { societeUpdateSchema } from "./schemas"

// ADR-0012 — Societe PATCH validation contract.
describe("societeUpdateSchema", () => {
  it("accepts a partial update with known fields", () => {
    const result = societeUpdateSchema.safeParse({
      nom: "Nouveau nom",
      couleurPrimaire: "#0F766E",
    })
    expect(result.success).toBe(true)
  })

  it("accepts nulling an optional visual field", () => {
    const result = societeUpdateSchema.safeParse({ couleurPrimaire: null })
    expect(result.success).toBe(true)
  })

  it("rejects an empty change-set", () => {
    const result = societeUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects unknown keys (strict)", () => {
    const result = societeUpdateSchema.safeParse({
      nom: "ok",
      unknownField: "nope",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a non-hex couleurPrimaire", () => {
    expect(
      societeUpdateSchema.safeParse({ couleurPrimaire: "teal" }).success
    ).toBe(false)
    expect(
      societeUpdateSchema.safeParse({ couleurPrimaire: "#0F766" }).success
    ).toBe(false)
  })

  it("rejects a domaineEmail with protocol or path", () => {
    expect(
      societeUpdateSchema.safeParse({ domaineEmail: "https://acme.ma" }).success
    ).toBe(false)
    expect(
      societeUpdateSchema.safeParse({ domaineEmail: "acme.ma/path" }).success
    ).toBe(false)
    expect(
      societeUpdateSchema.safeParse({ domaineEmail: "acme.ma" }).success
    ).toBe(true)
  })
})
