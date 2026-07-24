import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

function mockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

describe("validateRequest", () => {
  it("returns ok:true with parsed data for valid input", async () => {
    const { validateRequest } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const result = validateRequest(loginSchema, { email: "a@b.com", password: "secret" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.email).toBe("a@b.com")
      expect(result.data.password).toBe("secret")
    }
  })

  it("returns ok:false with 400 response for invalid input", async () => {
    const { validateRequest } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const result = validateRequest(loginSchema, { email: "not-an-email", password: "" })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response).toBeInstanceOf(NextResponse)
      expect(result.response.status).toBe(400)
      const body = await result.response.json()
      expect(body.error).toBe("Données invalides")
    }
  })

  it("returns ok:false for empty body", async () => {
    const { validateRequest } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const result = validateRequest(loginSchema, {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
    }
  })

  it("returns ok:true when optional fields are omitted", async () => {
    const { validateRequest } = await import("./api-utils")
    const { utilisateurSchema } = await import("./schemas")
    const result = validateRequest(utilisateurSchema, {
      email: "a@b.com",
      nom: "Dupont",
      prenom: "Jean",
      poste: "Dev",
      role: "EMPLOYEE",
      societeId: "soc-1",
      departementId: "dep-1",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.email).toBe("a@b.com")
    }
  })
})

describe("withValidation", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("calls handler with validated data when auth succeeds and input is valid", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: true,
      user: {
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "EMPLOYEE",
        departementId: "dep-1",
        departement: "IT",
        poste: "Dev",
      },
    })

    const { withValidation } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withValidation(loginSchema, handler)
    const req = mockRequest({ email: "a@b.com", password: "secret" })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ id: "user-1" }),
      { email: "a@b.com", password: "secret" },
      {}
    )
  })

  it("returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
    })

    const { withValidation } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const handler = vi.fn()
    const wrapped = withValidation(loginSchema, handler)
    const req = mockRequest({ email: "a@b.com", password: "secret" })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns 400 when input is invalid", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "EMPLOYEE", departementId: "dep-1", departement: "IT", poste: "Dev" },
    })

    const { withValidation } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const handler = vi.fn()
    const wrapped = withValidation(loginSchema, handler)
    const req = mockRequest({ email: "bad" })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns 400 when body is not valid JSON", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "test@test.com", name: "Test", role: "EMPLOYEE", departementId: "dep-1", departement: "IT", poste: "Dev" },
    })

    const { withValidation } = await import("./api-utils")
    const { loginSchema } = await import("./schemas")
    const handler = vi.fn()
    const wrapped = withValidation(loginSchema, handler)
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe("password route integration (withValidation + passwordChangeSchema)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns 200 when auth succeeds and body is valid", async () => {
    const { passwordChangeSchema } = await import("./schemas")
    const { withValidation } = await import("./api-utils")
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@b.com", name: "A", role: "EMPLOYEE", departementId: "d-1", departement: "IT", poste: "Dev" },
    })

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }))
    const wrapped = withValidation(passwordChangeSchema, handler)
    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: "old", newPassword: "newpass123" }),
      headers: { "content-type": "application/json" },
    })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ id: "u-1" }),
      { currentPassword: "old", newPassword: "newpass123" },
      {}
    )
  })

  it("returns 400 when newPassword is too short", async () => {
    const { passwordChangeSchema } = await import("./schemas")
    const { withValidation } = await import("./api-utils")
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as any).mockResolvedValue({
      ok: true,
      user: { id: "u-1", email: "a@b.com", name: "A", role: "EMPLOYEE", departementId: "d-1", departement: "IT", poste: "Dev" },
    })

    const handler = vi.fn()
    const wrapped = withValidation(passwordChangeSchema, handler)
    const req = new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: "old", newPassword: "123" }),
      headers: { "content-type": "application/json" },
    })

    const response = await wrapped(req, { params: Promise.resolve({}) })

    expect(response.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })
})
