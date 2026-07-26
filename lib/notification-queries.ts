import { eq, desc, count } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { notifications } from "../db/schema/notifications"

export interface NotificationQueriesPort {
  listForUser(userId: string): Promise<unknown[]>
  countUnread(userId: string): Promise<number>
}

export class NotificationQueries {
  constructor(private _db: DrizzleDb) {}

  async listForUser(userId: string) {
    return this._db.query.notifications.findMany({
      where: eq(notifications.utilisateurId, userId),
      orderBy: [desc(notifications.creeLe)],
      limit: 50,
    })
  }

  async countUnread(userId: string): Promise<number> {
    const result = await this._db
      .select({ value: count() })
      .from(notifications)
      .where(eq(notifications.utilisateurId, userId))
    return result[0]?.value ?? 0
  }
}

export const notificationQueries = new NotificationQueries(db)