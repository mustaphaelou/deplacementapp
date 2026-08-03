import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const { mockGetSession, mockActifQuery } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockActifQuery: vi.fn(),
}))

vi.mock("./better-auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => mockActifQuery()),
        })),
      })),
    })),
  },
}))

vi.mock("../../db/schema/utilisateurs", () => ({ utilisateurs: {} }))
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }))

import {
  requireAuth,
  requireRole,
  requireAnyRole,
  hasAnyRole,
  getAuthUser,
} from "./session"
import type { AuthUser } from "./session"

function sessionUser() {
  return {
    id: "user-1",
    email: "jean@example.com",
    name: "Dupont",
    prenom: "Jean",
    role: "EMPLOYEE",
    departementId: "dep-1",
    poste: "Développeur",
    image: "/avatars/jean.png",
  }
}

function makeUser(role: string): AuthUser {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role,
    departementId: "dep-1",
    departement: "IT",
    poste: "Développeur",
    avatarUrl: null,
  }
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActifQuery.mockResolvedValue([{ actif: true }])
  })

  it("returns ok:false with 401 when auth() returns null", async () => {
    mockGetSession.mockResolvedValue(null)

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
    mockGetSession.mockResolvedValue({})

    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns 401 when the Utilisateur is deactivated (per-request actif check)", async () => {
    mockGetSession.mockResolvedValue({ user: sessionUser() })
    mockActifQuery.mockResolvedValue([{ actif: false }])

    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns 401 when the Utilisateur row no longer exists", async () => {
    mockGetSession.mockResolvedValue({ user: sessionUser() })
    mockActifQuery.mockResolvedValue([])

    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it("returns ok:true with the mapped AuthUser when auth succeeds", async () => {
    mockGetSession.mockResolvedValue({ user: sessionUser() })

    const result = await requireAuth()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user).toEqual({
        id: "user-1",
        email: "jean@example.com",
        name: "Jean Dupont",
        role: "EMPLOYEE",
        departementId: "dep-1",
        departement: "",
        poste: "Développeur",
        avatarUrl: "/avatars/jean.png",
      })
    }
  })
})

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActifQuery.mockResolvedValue([{ actif: true }])
  })

  it("returns null when auth() returns null", async () => {
    mockGetSession.mockResolvedValue(null)

    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it("returns null when session has no user", async () => {
    mockGetSession.mockResolvedValue({})

    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it("returns null when the Utilisateur is deactivated", async () => {
    mockGetSession.mockResolvedValue({ user: sessionUser() })
    mockActifQuery.mockResolvedValue([{ actif: false }])

    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it("returns AuthUser when session has user", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        ...sessionUser(),
        id: "user-2",
        email: "marie@example.com",
        name: "Curie",
        prenom: "Marie",
        role: "MANAGER",
        departementId: "dep-2",
        poste: "Chef de projet",
        image: null,
      },
    })

    const result = await getAuthUser()
    expect(result).not.toBeNull()
    expect(result).toEqual({
      id: "user-2",
      email: "marie@example.com",
      name: "Marie Curie",
      role: "MANAGER",
      departementId: "dep-2",
      departement: "",
      poste: "Chef de projet",
      avatarUrl: null,
    })
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
    const result = requireAnyRole(makeUser("GENERAL_DIRECTION"), [
      "FINANCE_ADMIN",
      "GENERAL_DIRECTION",
    ])

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
    const result = requireAnyRole(makeUser("EMPLOYEE"), [
      "FINANCE_ADMIN",
      "GENERAL_DIRECTION",
    ])

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
    expect(
      hasAnyRole("GENERAL_DIRECTION", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])
    ).toBe(true)
  })

  it("returns false when the role does not match any allowed role", () => {
    expect(hasAnyRole("EMPLOYEE", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])).toBe(
      false
    )
  })

  it("returns false when the allowed list is empty", () => {
    expect(hasAnyRole("FINANCE_ADMIN", [])).toBe(false)
  })

  it("returns false when the role casing differs from the allowed roles", () => {
    expect(
      hasAnyRole("finance_admin", ["FINANCE_ADMIN", "GENERAL_DIRECTION"])
    ).toBe(false)
  })
})

describe("seam surface", () => {
  it("exports the Better Auth instance and no next-auth re-exports", async () => {
    const mod = (await import("./session")) as unknown as Record<
      string,
      unknown
    >
    expect(mod.auth).toBeDefined()
    for (const name of [
      "handlers",
      "GET",
      "POST",
      "signIn",
      "signOut",
      "authConfig",
    ]) {
      expect(mod[name]).toBeUndefined()
    }
  })
})
