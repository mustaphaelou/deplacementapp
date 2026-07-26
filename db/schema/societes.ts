import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const societes = pgTable("societes", {
  id: text("id").primaryKey().default("default"),
  nom: text("nom").notNull(),
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  couleurPrimaire: text("couleurPrimaire"),
  nomExpediteurEmail: text("nomExpediteurEmail"),
  domaineEmail: text("domaineEmail"),
  creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
  modifieLe: timestamp("modifieLe", { precision: 3 }).notNull(),
})
