import { describe, it, expect } from "vitest"
import { toAuthUser, type AuthUser } from "./user-mapper"
import type { BetterAuthSessionUser } from "./user-mapper"

describe("toAuthUser", () => {
  it("maps a Better Auth session user onto the domain AuthUser shape", () => {
    const sessionUser: BetterAuthSessionUser = {
      id: "user-1",
      email: "jean@example.com",
      name: "Dupont",
      prenom: "Jean",
      role: "EMPLOYEE",
      departementId: "dep-1",
      poste: "Développeur",
      image: "/avatars/jean.png",
    }

    const result = toAuthUser(sessionUser)

    const expected: AuthUser = {
      id: "user-1",
      email: "jean@example.com",
      name: "Jean Dupont",
      role: "EMPLOYEE",
      departementId: "dep-1",
      departement: "",
      poste: "Développeur",
      avatarUrl: "/avatars/jean.png",
    }
    expect(result).toEqual(expected)
  })

  it("keeps the same AuthUser shape for both seam halves", () => {
    const keys = Object.keys(toAuthUser({})) as (keyof AuthUser)[]
    expect(keys.sort()).toEqual(
      [
        "id",
        "email",
        "name",
        "role",
        "departementId",
        "departement",
        "poste",
        "avatarUrl",
      ].sort()
    )
  })

  it("derives the display name from prenom + nom", () => {
    expect(toAuthUser({ prenom: "Marie", name: "Curie" }).name).toBe(
      "Marie Curie"
    )
  })

  it("tolerates missing optional fields", () => {
    const result = toAuthUser({ id: "user-2", email: "x@example.com" })
    expect(result).toEqual({
      id: "user-2",
      email: "x@example.com",
      name: "",
      role: "",
      departementId: "",
      departement: "",
      poste: "",
      avatarUrl: null,
    })
  })
})
