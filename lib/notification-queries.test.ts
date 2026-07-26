import { describe, it, expect, vi } from "vitest"
import { NotificationQueries } from "./notification-queries"

function mockDb() {
  return {
    query: {
      notifications: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ value: 0 }]),
      })),
    })),
  }
}

const fakeNotifications = [
  {
    id: "n-1",
    utilisateurId: "u-1",
    demandeId: "dd-1",
    titre: "Nouvelle demande",
    message: "Jean Dupont a soumis une demande.",
    lu: false,
    creeLe: new Date("2025-06-01T10:00:00Z"),
  },
  {
    id: "n-2",
    utilisateurId: "u-1",
    demandeId: null,
    titre: "Demande approuvée",
    message: "Votre demande a été approuvée.",
    lu: true,
    creeLe: new Date("2025-05-30T08:00:00Z"),
  },
]

describe("NotificationQueries", () => {
  it("listForUser returns notifications ordered by creeLe desc, capped at 50", async () => {
    const db = mockDb()
    db.query.notifications.findMany.mockResolvedValue(fakeNotifications)

    const queries = new NotificationQueries(db as any)
    const result = await queries.listForUser("u-1")

    expect(result).toEqual(fakeNotifications)
    expect(db.query.notifications.findMany).toHaveBeenCalledWith({
      where: expect.any(Object),
      orderBy: [expect.any(Object)],
      limit: 50,
    })
  })

  it("listForUser returns empty array when user has no notifications", async () => {
    const db = mockDb()
    db.query.notifications.findMany.mockResolvedValue([])

    const queries = new NotificationQueries(db as any)
    const result = await queries.listForUser("u-999")

    expect(result).toEqual([])
  })

  it("countUnread returns number of unread notifications for a user", async () => {
    const db = mockDb()
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ value: 3 }]),
      })),
    }))

    const queries = new NotificationQueries(db as any)
    const result = await queries.countUnread("u-1")

    expect(result).toBe(3)
  })

  it("countUnread returns 0 when user has no unread notifications", async () => {
    const db = mockDb()
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ value: 0 }]),
      })),
    }))

    const queries = new NotificationQueries(db as any)
    const result = await queries.countUnread("u-1")

    expect(result).toBe(0)
  })
})
