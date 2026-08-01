export interface CoutEstime {
  transport: number
  hebergement: number
  repas: number
  divers: number
  total: number
}

export interface PdfRendererAdapter {
  render(data: PdfRenderData): Promise<Buffer>
}

export interface PdfBranding {
  nom: string
  couleurPrimaire: string | null
}

export interface PdfRenderData {
  numero: string
  etape: string
  decision: string
  employeNom: string
  employePrenom: string
  employePoste: string
  employeDepartement: string
  motif: string[]
  dateDepart: Date
  dateRetour: Date
  destination: string
  typeTransport: string
  autreTransport: string | null
  vehicule: { nom: string; immatriculation: string } | null
  couts: CoutEstime
  avanceRequise: boolean
  montantAvance: number | null
  description: string | null
  creeLe: Date
  assigneA: { id: string; nom: string; prenom: string } | null
  branding: PdfBranding | null
}
