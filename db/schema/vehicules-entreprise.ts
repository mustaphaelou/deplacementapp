import {
  pgTable,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const vehiculesEntreprise = pgTable(
  "vehicules_entreprise",
  {
    id: text("id").primaryKey(),
    nom: text("nom").notNull(),
    immatriculation: text("immatriculation").notNull(),
    disponible: boolean("disponible").notNull().default(true),
    creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex().on(table.immatriculation)]
)
