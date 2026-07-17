import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({ ok: true, user: { id: "u-1" } }),
}))

vi.mock("@/lib/notification-queries", () => ({
  notificationQueries: {
    listForUser: vi.fn(),
  },
}))

const fakeNotifications = [
  {
    id: "n-1",
    utilisateurId: "u-1",
    demandeId: "dd-1",
    titre: "Nouvelle demande",
    message: "Jean Dupont a soumis une demande.",
    lu: false,
    creeLe: "2025-06-01T10:00:00.000Z",
  },
]

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the list of notifications for the authenticated user", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.listForUser as ReturnType<typeof vi.fn>).mockResolvedValue(fakeNotifications)

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ notifications: fakeNotifications })
  })

  it("returns an empty list when the user has no notifications", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.listForUser as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ notifications: [] })
  })

  it("returns 500 when the seam throws an unknown error", async () => {
    const { notificationQueries } = await import("@/lib/notification-queries")
    ;(notificationQueries.listForUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    )

    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe("Erreur interne")
  })
})
