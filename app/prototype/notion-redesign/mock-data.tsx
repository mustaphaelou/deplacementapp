import type { CSSProperties } from "react"
import {
  BarChart3,
  Building,
  Car,
  CheckCircle,
  Clock,
  FilePlus,
  FileText,
  Users,
  type LucideIcon,
} from "lucide-react"
import { formatCurrency } from "@/lib/constants"

export const BRAND = "#0F766E"
export const BRAND_DARK = "#0B5F55"
export const BRAND_SOFT = "rgba(15, 118, 110, 0.08)"

export const brandVars = {
  "--brand": BRAND,
  "--brand-dark": BRAND_DARK,
} as CSSProperties

export const SOCIETE_NOM = "HAY 2010 SARL"
export const UTILISATEUR = { prenom: "Yasmine", nom: "Benali", role: "Employé" }

export interface NavItem {
  label: string
  icon: string
}

export const NAV_GROUPS: { section: string; items: NavItem[] }[] = [
  {
    section: "Espace",
    items: [
      { label: "Tableau de bord", icon: "bar-chart-3" },
      { label: "Mes Demandes", icon: "file-text" },
      { label: "Nouvelle Demande", icon: "file-plus" },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Société", icon: "building" },
      { label: "Utilisateurs", icon: "users" },
      { label: "Véhicules", icon: "car" },
      { label: "Rapports", icon: "bar-chart-3" },
    ],
  },
]

export const NAV_ICONS: Record<string, LucideIcon> = {
  "bar-chart-3": BarChart3,
  building: Building,
  car: Car,
  "check-circle": CheckCircle,
  clock: Clock,
  "file-plus": FilePlus,
  "file-text": FileText,
  users: Users,
}

export interface MockDemande {
  numero: string
  employe: { prenom: string; nom: string }
  destination: string
  dateDepart: string
  dateRetour: string
  transport: string
  totalEstime: number
  avance: number | null
  etape: string
  decision: string
}

export const DEMANDES: MockDemande[] = [
  {
    numero: "DEM-2026-041",
    employe: { prenom: "Yasmine", nom: "Benali" },
    destination: "Casablanca",
    dateDepart: "2026-08-12",
    dateRetour: "2026-08-14",
    transport: "TRAIN",
    totalEstime: 1850,
    avance: 900,
    etape: "MANAGER_REVIEW",
    decision: "PENDING",
  },
  {
    numero: "DEM-2026-040",
    employe: { prenom: "Omar", nom: "El Amrani" },
    destination: "Marrakech",
    dateDepart: "2026-08-05",
    dateRetour: "2026-08-06",
    transport: "VOITURE_PERSONNELLE",
    totalEstime: 1240,
    avance: null,
    etape: "DRAFT",
    decision: "PENDING",
  },
  {
    numero: "DEM-2026-039",
    employe: { prenom: "Salma", nom: "Idrissi" },
    destination: "Agadir",
    dateDepart: "2026-08-18",
    dateRetour: "2026-08-21",
    transport: "AVION",
    totalEstime: 4200,
    avance: 2000,
    etape: "FINANCE_REVIEW",
    decision: "PENDING",
  },
  {
    numero: "DEM-2026-038",
    employe: { prenom: "Karim", nom: "Tazi" },
    destination: "Fès",
    dateDepart: "2026-07-28",
    dateRetour: "2026-07-29",
    transport: "VOITURE_SOCIETE",
    totalEstime: 780,
    avance: null,
    etape: "DIRECTION_REVIEW",
    decision: "PENDING",
  },
  {
    numero: "DEM-2026-037",
    employe: { prenom: "Nadia", nom: "Chraibi" },
    destination: "Rabat",
    dateDepart: "2026-07-15",
    dateRetour: "2026-07-16",
    transport: "BUS",
    totalEstime: 640,
    avance: 300,
    etape: "FINAL",
    decision: "APPROVED",
  },
  {
    numero: "DEM-2026-036",
    employe: { prenom: "Hamza", nom: "Boutaleb" },
    destination: "Tanger",
    dateDepart: "2026-08-02",
    dateRetour: "2026-08-04",
    transport: "TRAIN",
    totalEstime: 2100,
    avance: null,
    etape: "MANAGER_REVIEW",
    decision: "REJECTED",
  },
]

export { formatCurrency }

export function LogoMark({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: "var(--brand)",
      }}
    >
      <span style={{ fontSize: Math.round(size * 0.45) }}>
        {SOCIETE_NOM.charAt(0)}
      </span>
    </div>
  )
}

export const TRANSPORT_OPTIONS = [
  { value: "VOITURE_PERSONNELLE", label: "Voiture personnelle" },
  { value: "VOITURE_SOCIETE", label: "Voiture de la société" },
  { value: "BUS", label: "Bus / Car" },
  { value: "AVION", label: "Avion" },
  { value: "TRAIN", label: "Train" },
  { value: "AUTRE", label: "Autre" },
]

export const DESTINATION_OPTIONS = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Agadir",
  "Fès",
  "Tanger",
  "Oujda",
  "Meknès",
]

export const MOTIF_OPTIONS = [
  "Mission client",
  "Formation",
  "Réunion",
  "Livraison",
  "Maintenance / Intervention",
  "Démarche administrative",
  "Autre",
]

export const FORM_FIELDS = [
  { label: "Destination", type: "select", placeholder: "Choisir une ville" },
  { label: "Motif", type: "select", placeholder: "Choisir un motif" },
  {
    label: "Type de transport",
    type: "select",
    placeholder: "Choisir un moyen",
  },
  { label: "Date de départ", type: "date", placeholder: "" },
  { label: "Date de retour", type: "date", placeholder: "" },
  { label: "Transport (Dhs)", type: "number", placeholder: "0,00" },
  { label: "Hébergement (Dhs)", type: "number", placeholder: "0,00" },
  { label: "Repas (Dhs)", type: "number", placeholder: "0,00" },
  { label: "Divers (Dhs)", type: "number", placeholder: "0,00" },
  { label: "Montant de l'avance (Dhs)", type: "number", placeholder: "0,00" },
]

