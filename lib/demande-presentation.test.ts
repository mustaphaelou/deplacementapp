import { describe, it, expect } from "vitest"
import {
  toDemandePresentation,
  toDemandeDocumentView,
  DECISION_LABELS,
  ETAPE_LABELS,
  MOTIF_LABELS,
  TRANSPORT_LABELS,
  type DecisionOutcome,
  type DemandeDocumentInput,
  type PresentationTone,
  type StepState,
} from "./demande-presentation"
import type { Etape, Decision } from "./workflow"

// CONTEXT.md — a DemandeDeplacement has exactly one Etape (where it sits in the
// pipeline) and exactly one Decision (what was decided there). The pipeline
// order below is the contract: DRAFT → MANAGER_REVIEW → FINANCE_REVIEW →
// DIRECTION_REVIEW → FINAL.

const ETAPES: Etape[] = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

const DECISIONS: Decision[] = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]

interface SpaceCase {
  etape: Etape
  decision: Decision
  etapeLabel: string
  decisionLabel: string
  outcome: DecisionOutcome
  tone: PresentationTone
  compactLabel: string
}

// The full Etape × Decision space, pinned literally: labels, outcome, tone and
// the compact label rule (decision-first; a rejection names its stage).
const SPACE: SpaceCase[] = [
  {
    etape: "DRAFT",
    decision: "PENDING",
    etapeLabel: "Brouillon",
    decisionLabel: "En cours",
    outcome: "pending",
    tone: "neutral",
    compactLabel: "Brouillon",
  },
  {
    etape: "DRAFT",
    decision: "APPROVED",
    etapeLabel: "Brouillon",
    decisionLabel: "Approuvée",
    outcome: "approved",
    tone: "success",
    compactLabel: "Approuvée",
  },
  {
    etape: "DRAFT",
    decision: "REJECTED",
    etapeLabel: "Brouillon",
    decisionLabel: "Rejetée",
    outcome: "rejected",
    tone: "danger",
    compactLabel: "Rejetée",
  },
  {
    etape: "DRAFT",
    decision: "WITHDRAWN",
    etapeLabel: "Brouillon",
    decisionLabel: "Retirée",
    outcome: "withdrawn",
    tone: "neutral",
    compactLabel: "Retirée",
  },
  {
    etape: "MANAGER_REVIEW",
    decision: "PENDING",
    etapeLabel: "En attente (Manager)",
    decisionLabel: "En cours",
    outcome: "pending",
    tone: "pending",
    compactLabel: "En attente (Manager)",
  },
  {
    etape: "MANAGER_REVIEW",
    decision: "APPROVED",
    etapeLabel: "En attente (Manager)",
    decisionLabel: "Approuvée",
    outcome: "approved",
    tone: "success",
    compactLabel: "Approuvée",
  },
  {
    etape: "MANAGER_REVIEW",
    decision: "REJECTED",
    etapeLabel: "En attente (Manager)",
    decisionLabel: "Rejetée",
    outcome: "rejected",
    tone: "danger",
    compactLabel: "Rejetée (Manager)",
  },
  {
    etape: "MANAGER_REVIEW",
    decision: "WITHDRAWN",
    etapeLabel: "En attente (Manager)",
    decisionLabel: "Retirée",
    outcome: "withdrawn",
    tone: "neutral",
    compactLabel: "Retirée",
  },
  {
    etape: "FINANCE_REVIEW",
    decision: "PENDING",
    etapeLabel: "En attente (Finance)",
    decisionLabel: "En cours",
    outcome: "pending",
    tone: "pending",
    compactLabel: "En attente (Finance)",
  },
  {
    etape: "FINANCE_REVIEW",
    decision: "APPROVED",
    etapeLabel: "En attente (Finance)",
    decisionLabel: "Approuvée",
    outcome: "approved",
    tone: "success",
    compactLabel: "Approuvée",
  },
  {
    etape: "FINANCE_REVIEW",
    decision: "REJECTED",
    etapeLabel: "En attente (Finance)",
    decisionLabel: "Rejetée",
    outcome: "rejected",
    tone: "danger",
    compactLabel: "Rejetée (Finance)",
  },
  {
    etape: "FINANCE_REVIEW",
    decision: "WITHDRAWN",
    etapeLabel: "En attente (Finance)",
    decisionLabel: "Retirée",
    outcome: "withdrawn",
    tone: "neutral",
    compactLabel: "Retirée",
  },
  {
    etape: "DIRECTION_REVIEW",
    decision: "PENDING",
    etapeLabel: "En attente (Direction)",
    decisionLabel: "En cours",
    outcome: "pending",
    tone: "pending",
    compactLabel: "En attente (Direction)",
  },
  {
    etape: "DIRECTION_REVIEW",
    decision: "APPROVED",
    etapeLabel: "En attente (Direction)",
    decisionLabel: "Approuvée",
    outcome: "approved",
    tone: "success",
    compactLabel: "Approuvée",
  },
  {
    etape: "DIRECTION_REVIEW",
    decision: "REJECTED",
    etapeLabel: "En attente (Direction)",
    decisionLabel: "Rejetée",
    outcome: "rejected",
    tone: "danger",
    compactLabel: "Rejetée (Direction)",
  },
  {
    etape: "DIRECTION_REVIEW",
    decision: "WITHDRAWN",
    etapeLabel: "En attente (Direction)",
    decisionLabel: "Retirée",
    outcome: "withdrawn",
    tone: "neutral",
    compactLabel: "Retirée",
  },
  {
    etape: "FINAL",
    decision: "PENDING",
    etapeLabel: "Finalisé",
    decisionLabel: "En cours",
    outcome: "pending",
    tone: "success",
    compactLabel: "Finalisé",
  },
  {
    etape: "FINAL",
    decision: "APPROVED",
    etapeLabel: "Finalisé",
    decisionLabel: "Approuvée",
    outcome: "approved",
    tone: "success",
    compactLabel: "Approuvée",
  },
  {
    etape: "FINAL",
    decision: "REJECTED",
    etapeLabel: "Finalisé",
    decisionLabel: "Rejetée",
    outcome: "rejected",
    tone: "danger",
    compactLabel: "Rejetée",
  },
  {
    etape: "FINAL",
    decision: "WITHDRAWN",
    etapeLabel: "Finalisé",
    decisionLabel: "Retirée",
    outcome: "withdrawn",
    tone: "neutral",
    compactLabel: "Retirée",
  },
]

const STAGE_LABELS = [
  "Brouillon",
  "En attente (Manager)",
  "En attente (Finance)",
  "En attente (Direction)",
  "Finalisé",
]

describe("toDemandePresentation", () => {
  it("is exhaustive over the Etape × Decision space", () => {
    const combos = SPACE.map((c) => `${c.etape}:${c.decision}`)
    expect(combos).toHaveLength(ETAPES.length * DECISIONS.length)
    expect(new Set(combos).size).toBe(combos.length)
    for (const etape of ETAPES) {
      for (const decision of DECISIONS) {
        expect(combos).toContain(`${etape}:${decision}`)
      }
    }
  })

  it.each(SPACE)(
    "$etape + $decision → labels, outcome, tone and compact label",
    ({
      etape,
      decision,
      etapeLabel,
      decisionLabel,
      outcome,
      tone,
      compactLabel,
    }) => {
      const presentation = toDemandePresentation({ etape, decision })

      expect(presentation.etape.id).toBe(etape)
      expect(presentation.etape.label).toBe(etapeLabel)
      expect(presentation.etape.index).toBe(ETAPES.indexOf(etape))

      expect(presentation.decision.value).toBe(decision)
      expect(presentation.decision.label).toBe(decisionLabel)
      expect(presentation.decision.outcome).toBe(outcome)

      expect(presentation.tone).toBe(tone)
      expect(presentation.compactLabel).toBe(compactLabel)
    }
  )
})

describe("toDemandePresentation — steps", () => {
  const STEP_STATES: Record<Etape, StepState[]> = {
    DRAFT: ["current", "upcoming", "upcoming", "upcoming", "upcoming"],
    MANAGER_REVIEW: ["past", "current", "upcoming", "upcoming", "upcoming"],
    FINANCE_REVIEW: ["past", "past", "current", "upcoming", "upcoming"],
    DIRECTION_REVIEW: ["past", "past", "past", "current", "upcoming"],
    FINAL: ["past", "past", "past", "past", "current"],
  }

  it.each(ETAPES)(
    "%s: the pipeline strip is past — current — upcoming around its stage",
    (etape) => {
      const { steps } = toDemandePresentation({ etape, decision: "PENDING" })

      expect(steps.map((s) => s.id)).toEqual(ETAPES)
      expect(steps.map((s) => s.label)).toEqual(STAGE_LABELS)
      expect(steps.map((s) => s.state)).toEqual(STEP_STATES[etape])
    }
  )

  it("keeps the strip on the Etape even after a terminal Decision", () => {
    const rejected = toDemandePresentation({
      etape: "FINANCE_REVIEW",
      decision: "REJECTED",
    })
    expect(rejected.steps.map((s) => s.state)).toEqual(
      STEP_STATES.FINANCE_REVIEW
    )

    const withdrawn = toDemandePresentation({
      etape: "DRAFT",
      decision: "WITHDRAWN",
    })
    expect(withdrawn.steps.map((s) => s.state)).toEqual(STEP_STATES.DRAFT)
  })
})

describe("toDemandePresentation — unknown values", () => {
  it("labels an unknown Etape with its raw value and marks no stage current", () => {
    const presentation = toDemandePresentation({
      etape: "ARCHIVED",
      decision: "PENDING",
    })

    expect(presentation.etape.label).toBe("ARCHIVED")
    expect(presentation.etape.index).toBe(-1)
    expect(presentation.tone).toBe("pending")
    expect(presentation.compactLabel).toBe("ARCHIVED")
    expect(presentation.steps.every((s) => s.state === "upcoming")).toBe(true)
  })

  it("labels an unknown Decision with its raw value and treats it as PENDING", () => {
    const presentation = toDemandePresentation({
      etape: "MANAGER_REVIEW",
      decision: "SUPERSEDED",
    })

    expect(presentation.decision.label).toBe("SUPERSEDED")
    expect(presentation.decision.outcome).toBe("pending")
    expect(presentation.tone).toBe("pending")
    expect(presentation.compactLabel).toBe("En attente (Manager)")
  })

  it("takes the tone from the Etape when the Decision is unknown", () => {
    expect(
      toDemandePresentation({ etape: "FINAL", decision: "SUPERSEDED" }).tone
    ).toBe("success")
    expect(
      toDemandePresentation({ etape: "DRAFT", decision: "SUPERSEDED" }).tone
    ).toBe("neutral")
  })
})

// ─── The display vocabulary and the document projection ─────────────────────
//
// The module owns the whole DemandeDeplacement display vocabulary — Etape,
// Decision, Motif and TypeTransport — and toDemandeDocumentView, the labelled
// document shape the PDF, the printable page and the CSV export serialize
// from. The suites below pin the vocabulary and the uniform fallback: an
// unmapped value comes out as its stored value verbatim — never blank, never
// prettified.

describe("MOTIF_LABELS and TRANSPORT_LABELS", () => {
  it("pins the Motif vocabulary literally, in the form's option order", () => {
    expect(MOTIF_LABELS).toEqual({
      mission_client: "Mission client",
      formation: "Formation",
      reunion: "Réunion",
      livraison: "Livraison",
      maintenance: "Maintenance / Intervention",
      administratif: "Démarche administrative",
      autre: "Autre",
    })
    expect(Object.keys(MOTIF_LABELS)).toEqual([
      "mission_client",
      "formation",
      "reunion",
      "livraison",
      "maintenance",
      "administratif",
      "autre",
    ])
  })

  it("pins the TypeTransport vocabulary literally", () => {
    expect(TRANSPORT_LABELS).toEqual({
      VOITURE_PERSONNELLE: "Voiture personnelle",
      VOITURE_SOCIETE: "Voiture de la société",
      BUS: "Bus / Car",
      AVION: "Avion",
      TRAIN: "Train",
      AUTRE: "Autre",
    })
    expect(Object.keys(TRANSPORT_LABELS)).toEqual([
      "VOITURE_PERSONNELLE",
      "VOITURE_SOCIETE",
      "BUS",
      "AVION",
      "TRAIN",
      "AUTRE",
    ])
  })
})

// A production-shaped input: the Motif as its stored JSON-encoded list, the
// TypeTransport as its stored enum code, no Assignataire yet.
const DOCUMENT_INPUT: DemandeDocumentInput = {
  motif: '["mission_client","formation"]',
  typeTransport: "AVION",
  etape: "DRAFT",
  decision: "PENDING",
}

describe("toDemandeDocumentView — vocabulary coverage", () => {
  it("labels every canonical Motif stored as a one-element list", () => {
    for (const [value, label] of Object.entries(MOTIF_LABELS)) {
      const view = toDemandeDocumentView({
        ...DOCUMENT_INPUT,
        motif: JSON.stringify([value]),
      })
      expect(view.motifs).toEqual([label])
    }
  })

  it("labels every canonical TypeTransport", () => {
    for (const [value, label] of Object.entries(TRANSPORT_LABELS)) {
      const view = toDemandeDocumentView({
        ...DOCUMENT_INPUT,
        typeTransport: value,
      })
      expect(view.transport).toBe(label)
    }
  })

  it.each(ETAPES)(
    "carries the %s Etape label through the presentation",
    (etape) => {
      const view = toDemandeDocumentView({ ...DOCUMENT_INPUT, etape })

      expect(view.presentation.etape.id).toBe(etape)
      expect(view.presentation.etape.label).toBe(ETAPE_LABELS[etape])
      expect(view.presentation.etape.label).not.toBe("")
    }
  )

  it.each(DECISIONS)(
    "carries the %s Decision label through the presentation",
    (decision) => {
      const view = toDemandeDocumentView({ ...DOCUMENT_INPUT, decision })

      expect(view.presentation.decision.value).toBe(decision)
      expect(view.presentation.decision.label).toBe(DECISION_LABELS[decision])
      expect(view.presentation.decision.label).not.toBe("")
    }
  )

  it("carries exactly toDemandePresentation's output over the whole space", () => {
    for (const etape of ETAPES) {
      for (const decision of DECISIONS) {
        const view = toDemandeDocumentView({
          ...DOCUMENT_INPUT,
          etape,
          decision,
        })
        expect(view.presentation).toEqual(
          toDemandePresentation({ etape, decision })
        )
      }
    }
  })
})

describe("toDemandeDocumentView — fallback: the stored value verbatim", () => {
  it("presents an unmapped Motif as its stored value", () => {
    const view = toDemandeDocumentView({
      ...DOCUMENT_INPUT,
      motif: JSON.stringify(["deep_sea_fishing"]),
    })
    expect(view.motifs).toEqual(["deep_sea_fishing"])
  })

  it("presents a stored free-text Motif verbatim", () => {
    const view = toDemandeDocumentView({
      ...DOCUMENT_INPUT,
      motif: JSON.stringify(["Autre: taxi collectif"]),
    })
    expect(view.motifs).toEqual(["Autre: taxi collectif"])
  })

  it("presents an unmapped TypeTransport as its stored value", () => {
    const view = toDemandeDocumentView({
      ...DOCUMENT_INPUT,
      typeTransport: "HOVERCRAFT",
    })
    expect(view.transport).toBe("HOVERCRAFT")
  })

  it("labels a mixed stored list and leaves the literal untouched", () => {
    const view = toDemandeDocumentView({
      ...DOCUMENT_INPUT,
      motif: '["mission_client","Autre: taxi collectif","formation"]',
    })
    expect(view.motifs).toEqual([
      "Mission client",
      "Autre: taxi collectif",
      "Formation",
    ])
  })

  it("never renders a stored value as a blank", () => {
    const motifValues = [
      ...Object.keys(MOTIF_LABELS),
      "deep_sea_fishing",
      "Autre: taxi collectif",
    ]
    for (const value of motifValues) {
      const view = toDemandeDocumentView({
        ...DOCUMENT_INPUT,
        motif: JSON.stringify([value]),
      })
      expect(view.motifs).toHaveLength(1)
      expect(view.motifs[0]).not.toBe("")
    }

    const transportValues = [...Object.keys(TRANSPORT_LABELS), "HOVERCRAFT"]
    for (const value of transportValues) {
      const view = toDemandeDocumentView({
        ...DOCUMENT_INPUT,
        typeTransport: value,
      })
      expect(view.transport).not.toBe("")
    }
  })
})

describe("toDemandeDocumentView — « Traité par » and the draft marking", () => {
  it("renders the Assignataire as « prenom nom »", () => {
    const view = toDemandeDocumentView({
      ...DOCUMENT_INPUT,
      assigneA: { prenom: "Jean", nom: "Dupont" },
    })
    expect(view.traitePar).toBe("Jean Dupont")
  })

  it("has no « Traité par » while no approver has acted", () => {
    expect(toDemandeDocumentView(DOCUMENT_INPUT).traitePar).toBeNull()
    expect(
      toDemandeDocumentView({ ...DOCUMENT_INPUT, assigneA: null }).traitePar
    ).toBeNull()
  })

  it("marks the DRAFT Etape as a draft and no other", () => {
    expect(
      toDemandeDocumentView({ ...DOCUMENT_INPUT, etape: "DRAFT" }).isDraft
    ).toBe(true)

    for (const etape of ETAPES.filter((e) => e !== "DRAFT")) {
      expect(toDemandeDocumentView({ ...DOCUMENT_INPUT, etape }).isDraft).toBe(
        false
      )
    }
  })
})
