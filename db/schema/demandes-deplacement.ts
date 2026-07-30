import {
  pgTable,
  text,
  timestamp,
  boolean,
  decimal,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { typeTransportEnum, etapeEnum, decisionEnum } from "./enums"
import { utilisateurs } from "./utilisateurs"
import { vehiculesEntreprise } from "./vehicules-entreprise"

export const demandesDeplacement = pgTable(
  "demandes_deplacement",
  {
    id: text("id").primaryKey(),
    numero: text("numero").notNull(),
    employeId: text("employeId")
      .notNull()
      .references(() => utilisateurs.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    assigneAId: text("assigneAId").references(() => utilisateurs.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    etape: etapeEnum("etape").notNull().default("DRAFT"),
    decision: decisionEnum("decision").notNull().default("PENDING"),

    employeNom: text("employeNom").notNull(),
    employePrenom: text("employePrenom").notNull(),
    employePoste: text("employePoste").notNull(),
    employeDepartement: text("employeDepartement").notNull(),

    motif: text("motif").notNull(),
    dateDepart: timestamp("dateDepart", { precision: 3 }).notNull(),
    dateRetour: timestamp("dateRetour", { precision: 3 }).notNull(),
    destination: text("destination").notNull(),
    typeTransport: typeTransportEnum("typeTransport").notNull(),
    autreTransport: text("autreTransport"),
    vehiculeId: text("vehiculeId").references(() => vehiculesEntreprise.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    fraisTransport: decimal("fraisTransport", {
      precision: 10,
      scale: 2,
    }).default("0"),
    fraisHebergement: decimal("fraisHebergement", {
      precision: 10,
      scale: 2,
    }).default("0"),
    fraisRepas: decimal("fraisRepas", { precision: 10, scale: 2 }).default("0"),
    fraisDivers: decimal("fraisDivers", { precision: 10, scale: 2 }).default(
      "0"
    ),
    totalEstime: decimal("totalEstime", { precision: 10, scale: 2 }).default(
      "0"
    ),

    avanceRequise: boolean("avanceRequise").notNull().default(false),
    montantAvance: decimal("montantAvance", { precision: 10, scale: 2 }),

    description: text("description"),

    commentaireManager: text("commentaireManager"),
    commentaireFinance: text("commentaireFinance"),
    commentaireDirection: text("commentaireDirection"),

    soumiseLe: timestamp("soumiseLe", { precision: 3 }),
    approuveeManagerLe: timestamp("approuveeManagerLe", { precision: 3 }),
    approuveeFinanceLe: timestamp("approuveeFinanceLe", { precision: 3 }),
    approuveeDirectionLe: timestamp("approuveeDirectionLe", { precision: 3 }),
    rejeteeLe: timestamp("rejeteeLe", { precision: 3 }),
    retireeLe: timestamp("retireeLe", { precision: 3 }),

    deletedAt: timestamp("deletedAt", { precision: 3 }),
    creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
    modifieLe: timestamp("modifieLe", { precision: 3 }).notNull(),
  },
  (table) => [uniqueIndex().on(table.numero)]
)
