import { describe, it, expect } from "vitest"
import { pdfChip, PDF_TONE_COLORS } from "./travel-request-pdf"
import {
  toDemandePresentation,
  type PresentationTone,
} from "@/lib/demande-presentation"

// The PDF chip carries the module's compact label, coloured by the module's
// tone: a rejection names the stage where it happened ("Rejetée (Finance)"),
// and a withdrawal is neutral grey — documents and screen must agree.

interface ChipCase {
  tone: PresentationTone
  etape: string
  decision: string
  label: string
  color: string
}

const CHIP_CASES: ChipCase[] = [
  {
    tone: "neutral",
    etape: "DRAFT",
    decision: "PENDING",
    label: "Brouillon",
    color: "#666666",
  },
  {
    tone: "pending",
    etape: "MANAGER_REVIEW",
    decision: "PENDING",
    label: "En attente (Manager)",
    color: "#d97706",
  },
  {
    tone: "success",
    etape: "FINAL",
    decision: "APPROVED",
    label: "Approuvée",
    color: "#16a34a",
  },
  {
    tone: "danger",
    etape: "FINANCE_REVIEW",
    decision: "REJECTED",
    label: "Rejetée (Finance)",
    color: "#dc2626",
  },
]

describe("pdfChip", () => {
  it("maps every presentation tone to its hex colour", () => {
    expect(Object.keys(PDF_TONE_COLORS).sort()).toEqual([
      "danger",
      "neutral",
      "pending",
      "success",
    ])
    expect(PDF_TONE_COLORS).toEqual({
      neutral: "#666666",
      pending: "#d97706",
      success: "#16a34a",
      danger: "#dc2626",
    })
  })

  it.each(CHIP_CASES)(
    "$etape + $decision → $label ($tone → $color)",
    ({ tone, etape, decision, label, color }) => {
      expect(toDemandePresentation({ etape, decision }).tone).toBe(tone)
      expect(pdfChip({ etape, decision })).toEqual({ label, color })
    }
  )

  it("keeps today's visible colours for the common cases", () => {
    // Brouillon grey / in-review amber / Approuvée green / Rejetée red.
    expect(pdfChip({ etape: "DRAFT", decision: "PENDING" }).color).toBe(
      "#666666"
    )
    expect(
      pdfChip({ etape: "DIRECTION_REVIEW", decision: "PENDING" }).color
    ).toBe("#d97706")
    expect(
      pdfChip({ etape: "DIRECTION_REVIEW", decision: "APPROVED" }).color
    ).toBe("#16a34a")
    expect(
      pdfChip({ etape: "MANAGER_REVIEW", decision: "REJECTED" }).color
    ).toBe("#dc2626")
  })

  it("shows a withdrawn demande as neutral grey, not red", () => {
    expect(pdfChip({ etape: "DRAFT", decision: "WITHDRAWN" })).toEqual({
      label: "Retirée",
      color: "#666666",
    })
  })

  it("names the stage on a rejection at every review stage", () => {
    expect(
      pdfChip({ etape: "MANAGER_REVIEW", decision: "REJECTED" }).label
    ).toBe("Rejetée (Manager)")
    expect(
      pdfChip({ etape: "FINANCE_REVIEW", decision: "REJECTED" }).label
    ).toBe("Rejetée (Finance)")
    expect(
      pdfChip({ etape: "DIRECTION_REVIEW", decision: "REJECTED" }).label
    ).toBe("Rejetée (Direction)")
  })
})
