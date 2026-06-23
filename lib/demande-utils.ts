import type { TypeTransport } from "@prisma/client"

export interface CreateDemandeData {
  motif: string[]
  motifAutre?: string
  dateDepart: string
  dateRetour: string
  destination: string
  typeTransport: TypeTransport
  autreTransport?: string
  vehiculeId?: string
  fraisTransport?: string
  fraisHebergement?: string
  fraisRepas?: string
  fraisDivers?: string
  avanceRequise?: boolean
  montantAvance?: string
  description?: string
}
