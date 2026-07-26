ALTER TABLE "utilisateurs" ALTER COLUMN "motDePasse" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "googleAuthEnabled" boolean DEFAULT false NOT NULL;