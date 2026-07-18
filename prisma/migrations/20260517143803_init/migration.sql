-- CreateEnum
CREATE TYPE "roles" AS ENUM ('EMPLOYEE', 'MANAGER', 'FINANCE_ADMIN', 'GENERAL_DIRECTION');

-- CreateEnum
CREATE TYPE "statuts_demande" AS ENUM ('BROUILLON', 'SOUMISE', 'APPROUVEE_MANAGER', 'APPROUVEE_FINANCE', 'APPROUVEE', 'REJETEE_MANAGER', 'REJETEE_FINANCE', 'REJETEE_DIRECTION', 'RETIREE');

-- CreateEnum
CREATE TYPE "types_transport" AS ENUM ('VOITURE_PERSONNELLE', 'VOITURE_SOCIETE', 'BUS', 'AVION', 'TRAIN', 'AUTRE');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "role" "roles" NOT NULL DEFAULT 'EMPLOYEE',
    "departementId" TEXT NOT NULL,
    "telephone" TEXT,
    "dateEmbauche" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departements" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_deplacement" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "assigneAId" TEXT,
    "statut" "statuts_demande" NOT NULL DEFAULT 'BROUILLON',
    "employeNom" TEXT NOT NULL,
    "employePrenom" TEXT NOT NULL,
    "employePoste" TEXT NOT NULL,
    "employeDepartement" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "dateRetour" TIMESTAMP(3) NOT NULL,
    "destination" TEXT NOT NULL,
    "typeTransport" "types_transport" NOT NULL,
    "autreTransport" TEXT,
    "vehiculeId" TEXT,
    "fraisTransport" DECIMAL(10,2) DEFAULT 0,
    "fraisHebergement" DECIMAL(10,2) DEFAULT 0,
    "fraisRepas" DECIMAL(10,2) DEFAULT 0,
    "fraisDivers" DECIMAL(10,2) DEFAULT 0,
    "totalEstime" DECIMAL(10,2) DEFAULT 0,
    "avanceRequise" BOOLEAN NOT NULL DEFAULT false,
    "montantAvance" DECIMAL(10,2),
    "description" TEXT,
    "commentaireManager" TEXT,
    "commentaireFinance" TEXT,
    "commentaireDirection" TEXT,
    "soumiseLe" TIMESTAMP(3),
    "approuveeManagerLe" TIMESTAMP(3),
    "approuveeFinanceLe" TIMESTAMP(3),
    "approuveeDirectionLe" TIMESTAMP(3),
    "rejeteeLe" TIMESTAMP(3),
    "retireeLe" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_deplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicules_entreprise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicules_entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "demandeId" TEXT,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departements_nom_key" ON "departements"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_deplacement_numero_key" ON "demandes_deplacement"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "vehicules_entreprise_immatriculation_key" ON "vehicules_entreprise"("immatriculation");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "vehicules_entreprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_deplacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_deplacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
