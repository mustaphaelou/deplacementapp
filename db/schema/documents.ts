import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { demandesDeplacement } from "./demandes-deplacement"

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  demandeId: text("demandeId")
    .notNull()
    .references(() => demandesDeplacement.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  type: text("type").notNull(),
  chemin: text("chemin").notNull(),
  creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
})
