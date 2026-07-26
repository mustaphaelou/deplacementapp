CREATE TYPE "public"."decision" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."etape" AS ENUM('DRAFT', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'DIRECTION_REVIEW', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."roles" AS ENUM('EMPLOYEE', 'MANAGER', 'FINANCE_ADMIN', 'GENERAL_DIRECTION');--> statement-breakpoint
CREATE TYPE "public"."statuts_demande" AS ENUM('BROUILLON', 'SOUMISE', 'APPROUVEE_MANAGER', 'APPROUVEE_FINANCE', 'APPROUVEE', 'REJETEE_MANAGER', 'REJETEE_FINANCE', 'REJETEE_DIRECTION', 'RETIREE');--> statement-breakpoint
CREATE TYPE "public"."types_transport" AS ENUM('VOITURE_PERSONNELLE', 'VOITURE_SOCIETE', 'BUS', 'AVION', 'TRAIN', 'AUTRE');--> statement-breakpoint
CREATE TABLE "societes" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"nom" text NOT NULL,
	"logoUrl" text,
	"faviconUrl" text,
	"couleurPrimaire" text,
	"nomExpediteurEmail" text,
	"domaineEmail" text,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL,
	"modifieLe" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departements" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"societeId" text NOT NULL,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "departements_nom_societeId_unique" UNIQUE("nom","societeId")
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"motDePasse" text NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"poste" text NOT NULL,
	"role" "roles" DEFAULT 'EMPLOYEE' NOT NULL,
	"departementId" text NOT NULL,
	"societeId" text NOT NULL,
	"avatarUrl" text,
	"telephone" text,
	"dateEmbauche" timestamp (3),
	"actif" boolean DEFAULT true NOT NULL,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL,
	"modifieLe" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicules_entreprise" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"immatriculation" text NOT NULL,
	"disponible" boolean DEFAULT true NOT NULL,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandes_deplacement" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"employeId" text NOT NULL,
	"assigneAId" text,
	"statut" "statuts_demande" DEFAULT 'BROUILLON' NOT NULL,
	"etape" "etape" DEFAULT 'DRAFT' NOT NULL,
	"decision" "decision" DEFAULT 'PENDING' NOT NULL,
	"employeNom" text NOT NULL,
	"employePrenom" text NOT NULL,
	"employePoste" text NOT NULL,
	"employeDepartement" text NOT NULL,
	"motif" text NOT NULL,
	"dateDepart" timestamp (3) NOT NULL,
	"dateRetour" timestamp (3) NOT NULL,
	"destination" text NOT NULL,
	"typeTransport" "types_transport" NOT NULL,
	"autreTransport" text,
	"vehiculeId" text,
	"fraisTransport" numeric(10, 2) DEFAULT '0',
	"fraisHebergement" numeric(10, 2) DEFAULT '0',
	"fraisRepas" numeric(10, 2) DEFAULT '0',
	"fraisDivers" numeric(10, 2) DEFAULT '0',
	"totalEstime" numeric(10, 2) DEFAULT '0',
	"avanceRequise" boolean DEFAULT false NOT NULL,
	"montantAvance" numeric(10, 2),
	"description" text,
	"commentaireManager" text,
	"commentaireFinance" text,
	"commentaireDirection" text,
	"soumiseLe" timestamp (3),
	"approuveeManagerLe" timestamp (3),
	"approuveeFinanceLe" timestamp (3),
	"approuveeDirectionLe" timestamp (3),
	"rejeteeLe" timestamp (3),
	"retireeLe" timestamp (3),
	"deletedAt" timestamp (3),
	"creeLe" timestamp (3) DEFAULT now() NOT NULL,
	"modifieLe" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"utilisateurId" text NOT NULL,
	"demandeId" text,
	"titre" text NOT NULL,
	"message" text NOT NULL,
	"lu" boolean DEFAULT false NOT NULL,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"utilisateurId" text NOT NULL,
	"action" text NOT NULL,
	"entite" text NOT NULL,
	"entiteId" text,
	"details" text,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"demandeId" text NOT NULL,
	"type" text NOT NULL,
	"chemin" text NOT NULL,
	"creeLe" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departements" ADD CONSTRAINT "departements_societeId_societes_id_fk" FOREIGN KEY ("societeId") REFERENCES "public"."societes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_departementId_departements_id_fk" FOREIGN KEY ("departementId") REFERENCES "public"."departements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_societeId_societes_id_fk" FOREIGN KEY ("societeId") REFERENCES "public"."societes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_employeId_utilisateurs_id_fk" FOREIGN KEY ("employeId") REFERENCES "public"."utilisateurs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_assigneAId_utilisateurs_id_fk" FOREIGN KEY ("assigneAId") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "demandes_deplacement" ADD CONSTRAINT "demandes_deplacement_vehiculeId_vehicules_entreprise_id_fk" FOREIGN KEY ("vehiculeId") REFERENCES "public"."vehicules_entreprise"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateurId_utilisateurs_id_fk" FOREIGN KEY ("utilisateurId") REFERENCES "public"."utilisateurs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_demandeId_demandes_deplacement_id_fk" FOREIGN KEY ("demandeId") REFERENCES "public"."demandes_deplacement"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateurId_utilisateurs_id_fk" FOREIGN KEY ("utilisateurId") REFERENCES "public"."utilisateurs"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_demandeId_demandes_deplacement_id_fk" FOREIGN KEY ("demandeId") REFERENCES "public"."demandes_deplacement"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateurs_email_index" ON "utilisateurs" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicules_entreprise_immatriculation_index" ON "vehicules_entreprise" USING btree ("immatriculation");--> statement-breakpoint
CREATE UNIQUE INDEX "demandes_deplacement_numero_index" ON "demandes_deplacement" USING btree ("numero");