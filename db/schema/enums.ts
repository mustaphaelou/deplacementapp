import { pgEnum } from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("roles", [
  "EMPLOYEE",
  "MANAGER",
  "FINANCE_ADMIN",
  "GENERAL_DIRECTION",
])

export const typeTransportEnum = pgEnum("types_transport", [
  "VOITURE_PERSONNELLE",
  "VOITURE_SOCIETE",
  "BUS",
  "AVION",
  "TRAIN",
  "AUTRE",
])

export const etapeEnum = pgEnum("etape", [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
])

export const decisionEnum = pgEnum("decision", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
])
