import { PIPELINE } from "./workflow"

// The single home of the Etape and Decision display vocabulary. Every surface
// that shows where a DemandeDeplacement sits in the pipeline, or what was
// decided there, reads from toDemandePresentation. The stage order is derived
// from PIPELINE — never re-declared here.

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
