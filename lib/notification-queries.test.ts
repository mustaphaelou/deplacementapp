import { describe, it, expect, vi } from "vitest"
import { NotificationQueries } from "./notification-queries"
import type { PrismaClient } from "@prisma/client"

interface MockedDb {
  notification: {
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
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
  // ── listForUser ──────────────────────────────────────────────────────

  it("listForUser returns notifications ordered by creeLe desc, capped at 50", async () => {
    const db = mockDb()
    db.notification.findMany.mockResolvedValue(fakeNotifications)

    const queries = new NotificationQueries(db as unknown as PrismaClient)
    const result = await queries.listForUser("u-1")

    expect(result).toEqual(fakeNotifications)
    expect(db.notification.findMany).toHaveBeenCalledWith({
      where: { utilisateurId: "u-1" },
      orderBy: { creeLe: "desc" },
      take: 50,
    })
  })

  it("listForUser returns empty array when user has no notifications", async () => {
    const db = mockDb()
    db.notification.findMany.mockResolvedValue([])

    const queries = new NotificationQueries(db as unknown as PrismaClient)
    const result = await queries.listForUser("u-999")

    expect(result).toEqual([])
  })

  // ── countUnread ─────────────────────────────────────────────────────

  it("countUnread returns number of unread notifications for a user", async () => {
    const db = mockDb()
    db.notification.count.mockResolvedValue(3)

    const queries = new NotificationQueries(db as unknown as PrismaClient)
    const result = await queries.countUnread("u-1")

    expect(result).toBe(3)
    expect(db.notification.count).toHaveBeenCalledWith({
      where: { utilisateurId: "u-1", lu: false },
    })
  })

  it("countUnread returns 0 when user has no unread notifications", async () => {
    const db = mockDb()
    db.notification.count.mockResolvedValue(0)

    const queries = new NotificationQueries(db as unknown as PrismaClient)
    const result = await queries.countUnread("u-1")

    expect(result).toBe(0)
  })
})
