import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}))

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: mockAuth,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }))
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }))
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }))
vi.mock("../../db", () => ({ db: {} }))
vi.mock("../../db/schema/utilisateurs", () => ({ utilisateurs: {} }))

import {
  requireAuth,
  requireRole,
  requireAnyRole,
  hasAnyRole,
  getAuthUser,
} from "./session"
import type { AuthUser } from "./session"

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

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns ok:false with 401 when auth() returns null", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(401)
      const body = await result.response.json()
      expect(body.error).toBe("Non autorisé")
    }
  })

  it("returns ok:false when session has no user", async () => {
    mockAuth.mockResolvedValue({})

    const result = await requireAuth()

    expect(result.ok).toBe(false)
  })

  it("returns ok:true with AuthUser when auth succeeds", async () => {
    const userFixture = {
      id: "user-1",
      email: "jean@example.com",
      name: "Jean Dupont",
      role: "EMPLOYEE",
      departementId: "dep-1",
      departement: "IT",
      poste: "Développeur",
    }

    mockAuth.mockResolvedValue({ user: userFixture })

    const result = await requireAuth()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe("user-1")
      expect(result.user.email).toBe("jean@example.com")
      expect(result.user.name).toBe("Jean Dupont")
      expect(result.user.role).toBe("EMPLOYEE")
    }
  })
})

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when auth() returns null", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it("returns null when session has no user", async () => {
    mockAuth.mockResolvedValue({})

    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it("returns AuthUser when session has user", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "user-2",
        email: "marie@example.com",
        name: "Marie Curie",
        role: "MANAGER",
        departementId: "dep-2",
        departement: "R&D",
        poste: "Chef de projet",
      },
    })

    const result = await getAuthUser()
    expect(result).not.toBeNull()
    expect(result!.id).toBe("user-2")
    expect(result!.email).toBe("marie@example.com")
    expect(result!.name).toBe("Marie Curie")
    expect(result!.role).toBe("MANAGER")
  })
})

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
