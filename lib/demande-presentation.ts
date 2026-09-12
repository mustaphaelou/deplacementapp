import { parseMotif } from "./demande-types"
import { PIPELINE } from "./workflow"

// The single home of the whole DemandeDeplacement display vocabulary — the
// Etape, the Decision, the Motif(s) and the TypeTransport — plus the document
// projection (toDemandeDocumentView) every document surface serializes from.
// Every surface that shows where a DemandeDeplacement sits in the pipeline,
// what was decided there, or which Motif / TypeTransport it carries, reads
// from this module. The stage order is derived from PIPELINE — never
// re-declared here.

export const ETAPE_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  MANAGER_REVIEW: "En attente (Manager)",
  FINANCE_REVIEW: "En attente (Finance)",
  DIRECTION_REVIEW: "En attente (Direction)",
  FINAL: "Finalisé",
}

export const DECISION_LABELS: Record<string, string> = {
  PENDING: "En cours",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
  WITHDRAWN: "Retirée",
}

// The stored Motif values are slugs; insertion order is the creation form's
// Motif option order — the form derives its options from this map, so the form
// and the documents share one source and cannot drift apart.
export const MOTIF_LABELS: Record<string, string> = {
  mission_client: "Mission client",
  formation: "Formation",
  reunion: "Réunion",
  livraison: "Livraison",
  maintenance: "Maintenance / Intervention",
  administratif: "Démarche administrative",
  autre: "Autre",
}

export const TRANSPORT_LABELS: Record<string, string> = {
  VOITURE_PERSONNELLE: "Voiture personnelle",
  VOITURE_SOCIETE: "Voiture de la société",
  BUS: "Bus / Car",
  AVION: "Avion",
  TRAIN: "Train",
  AUTRE: "Autre",
}

const STAGE_IDS: readonly string[] = PIPELINE.map((stage) => stage.id)

export type DecisionOutcome = "pending" | "approved" | "rejected" | "withdrawn"

export type PresentationTone = "neutral" | "pending" | "success" | "danger"

export type StepState = "past" | "current" | "upcoming"

export interface EtapePresentation {
  id: string
  label: string
  index: number
}

export interface DecisionPresentation {
  value: string
  label: string
  outcome: DecisionOutcome
}

export interface StepPresentation {
  id: string
  label: string
  state: StepState
}

export interface DemandePresentation {
  etape: EtapePresentation
  decision: DecisionPresentation
  tone: PresentationTone
  steps: StepPresentation[]
  compactLabel: string
}

const DECISION_OUTCOMES: Record<string, DecisionOutcome> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
}

const DECISION_TONES: Record<string, PresentationTone> = {
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
}

const ETAPE_TONES: Record<string, PresentationTone> = {
  DRAFT: "neutral",
  FINAL: "success",
}

const REJECTION_STAGE_NAMES: Record<string, string> = {
  MANAGER_REVIEW: "Manager",
  FINANCE_REVIEW: "Finance",
  DIRECTION_REVIEW: "Direction",
}

function toneOf(etape: string, decision: string): PresentationTone {
  const decisionTone = DECISION_TONES[decision]
  if (decisionTone) return decisionTone
  // PENDING — or an unknown Decision — takes its tone from the Etape:
  // DRAFT is neutral, FINAL reads as success, the review stages as pending.
  return ETAPE_TONES[etape] ?? "pending"
}

function compactLabelOf(etape: string, decision: string): string {
  const decisionLabel = DECISION_LABELS[decision] ?? decision
  if (decision === "REJECTED") {
    const rejectedAt = REJECTION_STAGE_NAMES[etape]
    return rejectedAt ? `${decisionLabel} (${rejectedAt})` : decisionLabel
  }
  if (decision === "APPROVED" || decision === "WITHDRAWN") {
    return decisionLabel
  }
  // PENDING — or an unknown Decision — is shown by the Etape it sits at.
  return ETAPE_LABELS[etape] ?? etape
}

export function toDemandePresentation(demande: {
  etape: string
  decision: string
}): DemandePresentation {
  const index = STAGE_IDS.indexOf(demande.etape)

  return {
    etape: {
      id: demande.etape,
      label: ETAPE_LABELS[demande.etape] ?? demande.etape,
      index,
    },
    decision: {
      value: demande.decision,
      label: DECISION_LABELS[demande.decision] ?? demande.decision,
      outcome: DECISION_OUTCOMES[demande.decision] ?? "pending",
    },
    tone: toneOf(demande.etape, demande.decision),
    steps: STAGE_IDS.map((stage, i): StepPresentation => ({
      id: stage,
      label: ETAPE_LABELS[stage] ?? stage,
      state: i < index ? "past" : i === index ? "current" : "upcoming",
    })),
    compactLabel: compactLabelOf(demande.etape, demande.decision),
  }
}

// ─── Document projection ─────────────────────────────────────────────────────
//
// toDemandeDocumentView turns a stored DemandeDeplacement into the labelled,
// document-shaped facts the PDF, the printable page and the CSV export all
// serialize. The input is a structural slice so every one of them can feed it.
// The fallback rule is uniform: a value with no label is presented as its
// stored value verbatim — never blank, never prettified.

export interface DemandeDocumentInput {
  /** The stored JSON-encoded Motif array (slugs and/or stored literals). */
  motif: string
  typeTransport: string
  etape: string
  decision: string
  assigneA?: { prenom: string; nom: string } | null
}

export interface DemandeDocumentView {
  /** Each stored entry → its Motif label; an unmapped entry verbatim. */
  motifs: string[]
  /** The TypeTransport label; an unmapped value verbatim. */
  transport: string
  /** Exactly toDemandePresentation({ etape, decision }) — same shape. */
  presentation: DemandePresentation
  /** The Assignataire as a display value for « Traité par »; null when unset. */
  traitePar: string | null
  /** The document-state marking the documents share: etape === "DRAFT". */
  isDraft: boolean
}

export function toDemandeDocumentView(
  demande: DemandeDocumentInput
): DemandeDocumentView {
  return {
    motifs: parseMotif(demande.motif).map(
      (motif) => MOTIF_LABELS[motif] ?? motif
    ),
    transport: TRANSPORT_LABELS[demande.typeTransport] ?? demande.typeTransport,
    presentation: toDemandePresentation({
      etape: demande.etape,
      decision: demande.decision,
    }),
    traitePar: demande.assigneA
      ? `${demande.assigneA.prenom} ${demande.assigneA.nom}`
      : null,
    isDraft: demande.etape === "DRAFT",
  }
}
