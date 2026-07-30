import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core"
import { utilisateurs } from "./utilisateurs"
import { demandesDeplacement } from "./demandes-deplacement"

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  utilisateurId: text("utilisateurId")
    .notNull()
    .references(() => utilisateurs.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  demandeId: text("demandeId").references(() => demandesDeplacement.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  titre: text("titre").notNull(),
  message: text("message").notNull(),
  lu: boolean("lu").notNull().default(false),
  creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
})
