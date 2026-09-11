export const TRANSPORT_LABELS: Record<string, string> = {
  VOITURE_PERSONNELLE: "Voiture personnelle",
  VOITURE_SOCIETE: "Voiture de la société",
  BUS: "Bus / Car",
  AVION: "Avion",
  TRAIN: "Train",
  AUTRE: "Autre",
}

export const PURPOSE_OPTIONS = [
  { value: "mission_client", label: "Mission client" },
  { value: "formation", label: "Formation" },
  { value: "reunion", label: "Réunion" },
  { value: "livraison", label: "Livraison" },
  { value: "maintenance", label: "Maintenance / Intervention" },
  { value: "administratif", label: "Démarche administrative" },
  { value: "autre", label: "Autre" },
]

export const ITEMS_PER_PAGE = [10, 25, 50]

export const DEFAULT_SOCIETE_NOM = "Application"

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "0,00 Dhs"
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} Dhs`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
