import { describe, it, expect } from "vitest"
import { NextResponse } from "next/server"
import { requireRole, requireAnyRole } from "./authorization"
import type { AuthUser } from "./auth-utils"

function makeUser(role: string): AuthUser {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role,
    departementId: "dep-1",
    departement: "IT",
    poste: "Développeur",
  }
}

describe("requireRole", () => {
  it("returns ok:true when the user has the required role", () => {
    const result = requireRole(makeUser("FINANCE_ADMIN"), "FINANCE_ADMIN")

    expect(result.ok).toBe(true)
  })

  it("returns ok:false with 403 when the user has a different role", async () => {
    const result = requireRole(makeUser("EMPLOYEE"), "FINANCE_ADMIN")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })
})

describe("requireAnyRole", () => {
  it("returns ok:true when the user has one of the required roles", () => {
    const result = requireAnyRole(makeUser("GENERAL_DIRECTION"), ["FINANCE_ADMIN", "GENERAL_DIRECTION"])

    expect(result.ok).toBe(true)
  })

  it("returns ok:false with 403 when the user has none of the required roles", async () => {
    const result = requireAnyRole(makeUser("EMPLOYEE"), ["FINANCE_ADMIN", "GENERAL_DIRECTION"])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })
})
