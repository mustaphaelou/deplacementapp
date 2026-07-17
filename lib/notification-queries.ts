import type { PrismaClient, Notification } from "@prisma/client"
import { prisma } from "./prisma"

export interface NotificationQueriesPort {
  listForUser(userId: string): Promise<Notification[]>
  countUnread(userId: string): Promise<number>
}

export class NotificationQueries {
  constructor(private db: PrismaClient) {}

  async listForUser(userId: string): Promise<Notification[]> {
    return this.db.notification.findMany({
      where: { utilisateurId: userId },
      orderBy: { creeLe: "desc" },
      take: 50,
    })
  }

  async countUnread(userId: string): Promise<number> {
    return this.db.notification.count({
      where: { utilisateurId: userId, lu: false },
    })
  }
}

export const notificationQueries = new NotificationQueries(prisma)
