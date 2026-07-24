-- CreateTable
CREATE TABLE "societes" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nom" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "couleurPrimaire" TEXT,
    "nomExpediteurEmail" TEXT,
    "domaineEmail" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "societes_pkey" PRIMARY KEY ("id")
);

-- Insert default Societe for existing data
INSERT INTO "societes" ("id", "nom", "modifieLe") VALUES ('default', 'Ma Société', NOW());

-- AlterTable: add societeId to utilisateurs (nullable first)
ALTER TABLE "utilisateurs" ADD COLUMN "societeId" TEXT;

-- Backfill existing utilisateurs
UPDATE "utilisateurs" SET "societeId" = 'default';

-- Make societeId NOT NULL
ALTER TABLE "utilisateurs" ALTER COLUMN "societeId" SET NOT NULL;

-- AlterTable: add societeId to departements (nullable first)
ALTER TABLE "departements" ADD COLUMN "societeId" TEXT;

-- Backfill existing departements
UPDATE "departements" SET "societeId" = 'default';

-- Make societeId NOT NULL
ALTER TABLE "departements" ALTER COLUMN "societeId" SET NOT NULL;

-- Drop old unique constraint on departements.nom
ALTER TABLE "departements" DROP CONSTRAINT "departements_nom_key";

-- CreateIndex
CREATE UNIQUE INDEX "departements_nom_societeId_key" ON "departements"("nom", "societeId");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "societes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departements" ADD CONSTRAINT "departements_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "societes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;