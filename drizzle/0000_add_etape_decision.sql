CREATE TYPE "etape" AS ENUM ('DRAFT', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'DIRECTION_REVIEW', 'FINAL');
CREATE TYPE "decision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

ALTER TABLE "demandes_deplacement" ADD COLUMN "etape" "etape";
ALTER TABLE "demandes_deplacement" ADD COLUMN "decision" "decision";

UPDATE "demandes_deplacement" SET
  "etape" = CASE "statut"
    WHEN 'BROUILLON' THEN 'DRAFT'::"etape"
    WHEN 'SOUMISE' THEN 'MANAGER_REVIEW'::"etape"
    WHEN 'APPROUVEE_MANAGER' THEN 'FINANCE_REVIEW'::"etape"
    WHEN 'APPROUVEE_FINANCE' THEN 'DIRECTION_REVIEW'::"etape"
    WHEN 'APPROUVEE' THEN 'FINAL'::"etape"
    WHEN 'REJETEE_MANAGER' THEN 'MANAGER_REVIEW'::"etape"
    WHEN 'REJETEE_FINANCE' THEN 'FINANCE_REVIEW'::"etape"
    WHEN 'REJETEE_DIRECTION' THEN 'DIRECTION_REVIEW'::"etape"
    WHEN 'RETIREE' THEN 'DRAFT'::"etape"
  END,
  "decision" = CASE "statut"
    WHEN 'BROUILLON' THEN 'PENDING'::"decision"
    WHEN 'SOUMISE' THEN 'PENDING'::"decision"
    WHEN 'APPROUVEE_MANAGER' THEN 'PENDING'::"decision"
    WHEN 'APPROUVEE_FINANCE' THEN 'PENDING'::"decision"
    WHEN 'APPROUVEE' THEN 'APPROVED'::"decision"
    WHEN 'REJETEE_MANAGER' THEN 'REJECTED'::"decision"
    WHEN 'REJETEE_FINANCE' THEN 'REJECTED'::"decision"
    WHEN 'REJETEE_DIRECTION' THEN 'REJECTED'::"decision"
    WHEN 'RETIREE' THEN 'WITHDRAWN'::"decision"
  END;

ALTER TABLE "demandes_deplacement" ALTER COLUMN "etape" SET NOT NULL;
ALTER TABLE "demandes_deplacement" ALTER COLUMN "decision" SET NOT NULL;
ALTER TABLE "demandes_deplacement" ALTER COLUMN "etape" SET DEFAULT 'DRAFT'::"etape";
ALTER TABLE "demandes_deplacement" ALTER COLUMN "decision" SET DEFAULT 'PENDING'::"decision";
