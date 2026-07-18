import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { NotificationNotFoundError, UnauthorizedActionError } from "@/lib/errors"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/notification-bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notification-bus")>()
  return {
    ...actual,
    notificationBus: {
      markAsRead: vi.fn(),
    },
  }
})

function mockAuth(userId = "u-1") {
  return {
    ok: true,
    user: {
      id: userId,
      email: "u-1@example.com",
      name: "User 1",
      role: "EMPLOYEE",
      departementId: "dep-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

function mockRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/notifications/${id}`)
}

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when auth fails", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 }),
    })

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest("n-1"), {
      params: Promise.resolve({ id: "n-1" }),
    })

    expect(response.status).toBe(401)
  })

  it("returns 200 when the owner marks their notification as read", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { notificationBus } = await import("@/lib/notification-bus")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth("u-1"))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(notificationBus.markAsRead as any).mockResolvedValue(undefined)

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest("n-1"), {
      params: Promise.resolve({ id: "n-1" }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })

    // The thin caller delegates ownership + persistence to the seam
    expect(notificationBus.markAsRead).toHaveBeenCalledWith("n-1", "u-1")
  })

  it("returns 404 driven by the seam when the notification does not exist", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { notificationBus } = await import("@/lib/notification-bus")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth("u-1"))
    ;(notificationBus.markAsRead as ReturnType<typeof vi.fn>).mockRejectedValue(
      new NotificationNotFoundError()
    )

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest("n-missing"), {
      params: Promise.resolve({ id: "n-missing" }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: "Notification introuvable" })
  })

  it("returns 403 driven by the seam when the requester is not the owner", async () => {
    const { requireAuth } = await import("@/lib/auth-utils")
    const { notificationBus } = await import("@/lib/notification-bus")

    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuth("u-2"))
    ;(notificationBus.markAsRead as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedActionError("Non autorisé")
    )

    const { PATCH } = await import("./route")
    const response = await PATCH(mockRequest("n-1"), {
      params: Promise.resolve({ id: "n-1" }),
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ error: "Non autorisé" })
  })
})
