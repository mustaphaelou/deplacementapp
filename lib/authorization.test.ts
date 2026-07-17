import { describe, it, expect } from "vitest"
import { NextResponse } from "next/server"
import { requireRole, requireAnyRole, hasAnyRole } from "./authorization"
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

  it("returns ok:false with 403 when the role casing differs", async () => {
    const result = requireRole(makeUser("finance_admin"), "FINANCE_ADMIN")

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

  it("returns ok:true when the user matches a single required role", () => {
    const result = requireAnyRole(makeUser("FINANCE_ADMIN"), ["FINANCE_ADMIN"])

    expect(result.ok).toBe(true)
  })

  it("returns ok:false with 403 when the user does not match a single required role", async () => {
    const result = requireAnyRole(makeUser("EMPLOYEE"), ["FINANCE_ADMIN"])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
  })

  it("returns ok:false with 403 when the required roles list is empty", async () => {
    const result = requireAnyRole(makeUser("FINANCE_ADMIN"), [])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toBe("Accès refusé")
    }
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

describe("hasAnyRole", () => {
  it("returns true when the role matches a single allowed role", () => {
    expect(hasAnyRole("FINANCE_ADMIN", ["FINANCE_ADMIN"])).toBe(true)
  })

  it("returns true when the role matches one of multiple allowed roles", () => {
    expect(hasAnyRole("GENERAL_DIRECTION", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])).toBe(true)
  })

  it("returns false when the role does not match any allowed role", () => {
    expect(hasAnyRole("EMPLOYEE", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])).toBe(false)
  })

  it("returns false when the allowed list is empty", () => {
    expect(hasAnyRole("FINANCE_ADMIN", [])).toBe(false)
  })

  it("returns false when the role casing differs from the allowed roles", () => {
    expect(hasAnyRole("finance_admin", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])).toBe(false)
  })
})
