import { relations } from "drizzle-orm"
import { societes } from "./societes"
import { departements } from "./departements"
import { utilisateurs } from "./utilisateurs"
import { demandesDeplacement } from "./demandes-deplacement"
import { vehiculesEntreprise } from "./vehicules-entreprise"
import { notifications } from "./notifications"
import { journalAudit } from "./journal-audit"
import { documents } from "./documents"

export const societesRelations = relations(societes, ({ many }) => ({
  utilisateurs: many(utilisateurs),
  departements: many(departements),
}))

export const departementsRelations = relations(
  departements,
  ({ one, many }) => ({
    societe: one(societes, {
      fields: [departements.societeId],
      references: [societes.id],
    }),
    utilisateurs: many(utilisateurs),
  })
)

export const utilisateursRelations = relations(
  utilisateurs,
  ({ one, many }) => ({
    departement: one(departements, {
      fields: [utilisateurs.departementId],
      references: [departements.id],
    }),
    societe: one(societes, {
      fields: [utilisateurs.societeId],
      references: [societes.id],
    }),
    demandes: many(demandesDeplacement, { relationName: "DemandeEmploye" }),
    demandesAssignees: many(demandesDeplacement, {
      relationName: "DemandeAssignee",
    }),
    notifications: many(notifications),
    journalAudits: many(journalAudit),
  })
)

export const vehiculesEntrepriseRelations = relations(
  vehiculesEntreprise,
  ({ many }) => ({
    demandes: many(demandesDeplacement),
  })
)

export const demandesDeplacementRelations = relations(
  demandesDeplacement,
  ({ one, many }) => ({
    employe: one(utilisateurs, {
      fields: [demandesDeplacement.employeId],
      references: [utilisateurs.id],
      relationName: "DemandeEmploye",
    }),
    assigneA: one(utilisateurs, {
      fields: [demandesDeplacement.assigneAId],
      references: [utilisateurs.id],
      relationName: "DemandeAssignee",
    }),
    vehicule: one(vehiculesEntreprise, {
      fields: [demandesDeplacement.vehiculeId],
      references: [vehiculesEntreprise.id],
    }),
    notifications: many(notifications),
    documents: many(documents),
  })
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  utilisateur: one(utilisateurs, {
    fields: [notifications.utilisateurId],
    references: [utilisateurs.id],
  }),
  demande: one(demandesDeplacement, {
    fields: [notifications.demandeId],
    references: [demandesDeplacement.id],
  }),
}))

export const journalAuditRelations = relations(journalAudit, ({ one }) => ({
  utilisateur: one(utilisateurs, {
    fields: [journalAudit.utilisateurId],
    references: [utilisateurs.id],
  }),
}))

export const documentsRelations = relations(documents, ({ one }) => ({
  demande: one(demandesDeplacement, {
    fields: [documents.demandeId],
    references: [demandesDeplacement.id],
  }),
}))
