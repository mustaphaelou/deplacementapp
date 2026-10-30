-- 0000 backfills the Etape + Decision columns onto an EXISTING
-- demandes_deplacement table, deriving them from the legacy `statut` enum.
--
-- It therefore runs BEFORE 0001, which is the migration that creates the table
-- itself (already carrying `etape` and `decision`). On a database that predates
-- the versioning this file does real work; on an empty one the table does not
-- exist yet and every statement in it fails.
--
-- `drizzle-kit migrate` (unlike the test harness, which swallows failures) has
-- no way to skip a failed migration, so the versioned chain aborted on a fresh
-- database. The work is wrapped in a DO block that no-ops when the table is
-- absent, and guards each column so a re-run against a partially migrated
-- database is safe. The backfill itself is unchanged: same CASE mapping from
-- `statut` to (etape, decision), same NOT NULL and DEFAULT constraints.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'demandes_deplacement'
  ) THEN
    CREATE TYPE "etape" AS ENUM ('DRAFT', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'DIRECTION_REVIEW', 'FINAL');
    CREATE TYPE "decision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'demandes_deplacement' AND column_name = 'etape'
    ) THEN
      ALTER TABLE "demandes_deplacement" ADD COLUMN "etape" "etape";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'demandes_deplacement' AND column_name = 'decision'
    ) THEN
      ALTER TABLE "demandes_deplacement" ADD COLUMN "decision" "decision";
    END IF;

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
  END IF;
END $$;
