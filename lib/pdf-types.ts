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
  /**
   * The Motif labels to print — every stored entry already mapped through
   * `MOTIF_LABELS` by the document projection, an unmapped entry verbatim.
   * Never a stored slug: the renderer is handed display values only, so it
   * cannot drift back to the storage vocabulary.
   */
  motifsLabels: string[]
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
