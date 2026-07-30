import { and, eq, desc, count } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { notifications } from "../../db/schema/notifications"

export async function listForUser(userId: string, db: DrizzleDb) {
  return db.query.notifications.findMany({
    where: eq(notifications.utilisateurId, userId),
    orderBy: [desc(notifications.creeLe)],
    limit: 50,
  })
}

export async function countUnread(
  userId: string,
  db: DrizzleDb
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.utilisateurId, userId), eq(notifications.lu, false))
    )
  return result[0]?.value ?? 0
}
