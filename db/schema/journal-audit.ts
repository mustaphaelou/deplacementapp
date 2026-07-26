import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { utilisateurs } from "./utilisateurs"

export const journalAudit = pgTable("journal_audit", {
  id: text("id").primaryKey(),
  utilisateurId: text("utilisateurId")
    .notNull()
    .references(() => utilisateurs.id, { onDelete: "restrict", onUpdate: "cascade" }),
  action: text("action").notNull(),
  entite: text("entite").notNull(),
  entiteId: text("entiteId"),
  details: text("details"),
  creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
})
