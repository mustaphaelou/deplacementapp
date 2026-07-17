import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({ ok: true, user: { id: "u-1" } }),
}))

vi.mock("@/lib/notification-queries", () => ({
  notificationQueries: {
    countUnread: vi.fn(),
  },
}))

describe("GET /api/notifications/compter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the count of unread notifications for the authenticated user", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.countUnread as ReturnType<typeof vi.fn>).mockResolvedValue(5)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ count: 5 })
  })

  it("returns 0 when there are no unread notifications", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.countUnread as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ count: 0 })
  })

  it("returns 500 when the seam throws an unknown error", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.countUnread as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur interne")
  })
})
