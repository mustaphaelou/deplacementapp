import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"
import { societes } from "./societes"

export const departements = pgTable(
  "departements",
  {
    id: text("id").primaryKey(),
    nom: text("nom").notNull(),
    societeId: text("societeId")
      .notNull()
      .references(() => societes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.nom, table.societeId)],
)
