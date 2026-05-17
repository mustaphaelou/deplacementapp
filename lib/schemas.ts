import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
})

export const transportFields = z.object({
  typeTransport: z.enum([
    "VOITURE_PERSONNELLE",
    "VOITURE_SOCIETE",
    "BUS",
    "AVION",
    "TRAIN",
    "AUTRE",
  ]),
  autreTransport: z.string().optional(),
  vehiculeId: z.string().optional(),
})

export const demandeSchema = z.object({
  motif: z.array(z.string()).min(1, "Sélectionnez au moins un motif"),
  motifAutre: z.string().optional(),
  dateDepart: z.string().min(1, "Date de départ requise"),
  dateRetour: z.string().min(1, "Date de retour requise"),
  destination: z.string().min(2, "Destination requise"),
  typeTransport: z.enum([
    "VOITURE_PERSONNELLE",
    "VOITURE_SOCIETE",
    "BUS",
    "AVION",
    "TRAIN",
    "AUTRE",
  ]),
  autreTransport: z.string().optional(),
  vehiculeId: z.string().optional(),
  fraisTransport: z.string().optional(),
  fraisHebergement: z.string().optional(),
  fraisRepas: z.string().optional(),
  fraisDivers: z.string().optional(),
  avanceRequise: z.boolean().default(false),
  montantAvance: z.string().optional(),
  description: z.string().optional(),
}).refine(
  (data) => {
    if (!data.dateDepart || !data.dateRetour) return true
    return new Date(data.dateRetour) >= new Date(data.dateDepart)
  },
  { message: "La date de retour doit être après la date de départ", path: ["dateRetour"] }
)

export type DemandeFormValues = z.infer<typeof demandeSchema>

export const rejetSchema = z.object({
  commentaire: z.string().min(1, "Le commentaire est obligatoire pour le rejet"),
})

export const approbationSchema = z.object({
  commentaire: z.string().optional(),
})

export const utilisateurSchema = z.object({
  email: z.string().email("Email invalide"),
  nom: z.string().min(1, "Nom requis"),
  prenom: z.string().min(1, "Prénom requis"),
  poste: z.string().min(1, "Poste requis"),
  role: z.enum(["EMPLOYEE", "MANAGER", "FINANCE_ADMIN", "GENERAL_DIRECTION"]),
  departementId: z.string().min(1, "Département requis"),
  telephone: z.string().optional(),
  motDePasse: z.string().min(6, "Minimum 6 caractères").optional().or(z.literal("")),
})

export const vehiculeSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  immatriculation: z.string().min(1, "Immatriculation requise"),
  disponible: z.boolean().default(true),
})
