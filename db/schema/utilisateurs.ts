import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { roleEnum } from "./enums"
import { departements } from "./departements"
import { societes } from "./societes"

export const utilisateurs = pgTable(
  "utilisateurs",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    googleAuthEnabled: boolean("googleAuthEnabled").notNull().default(false),
    // Forced rotation after an administrator-provisioned credential (#238):
    // true when the account's password was set by someone else (generated
    // temporary at provisioning, admin reset) and the holder has not chosen
    // their own yet. The dashboard gate blocks on it until changePassword
    // clears it.
    doitChangerMotDePasse: boolean("doitChangerMotDePasse")
      .notNull()
      .default(false),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull(),
    poste: text("poste").notNull(),
    role: roleEnum("role").notNull().default("EMPLOYEE"),
    departementId: text("departementId")
      .notNull()
      .references(() => departements.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    societeId: text("societeId")
      .notNull()
      .references(() => societes.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    avatarUrl: text("avatarUrl"),
    telephone: text("telephone"),
    dateEmbauche: timestamp("dateEmbauche", { precision: 3 }),
    actif: boolean("actif").notNull().default(true),
    creeLe: timestamp("creeLe", { precision: 3 }).notNull().defaultNow(),
    modifieLe: timestamp("modifieLe", { precision: 3 }).notNull(),
  },
  (table) => [uniqueIndex().on(table.email)]
)
