DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'etape') THEN
		CREATE TYPE "public"."etape" AS ENUM ('DRAFT', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'DIRECTION_REVIEW', 'FINAL');
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision') THEN
		CREATE TYPE "public"."decision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'demandes_deplacement'
	) AND EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'demandes_deplacement' AND column_name = 'statut'
	) THEN
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
