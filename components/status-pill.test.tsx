import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { StatusPill, statusOf } from "@/components/status-pill"

describe("StatusPill", () => {
  it("renders the locked soft tones for each status tone", () => {
    const cases: [string, string, string][] = [
      ["neutral", "bg-[#F1F1EF]", "text-[#37352F]"],
      ["pending", "bg-[#FBF0DB]", "text-[#8B5E0E]"],
      ["success", "bg-[#E5F3EE]", "text-[#0F6E4F]"],
      ["danger", "bg-[#FBE9E9]", "text-[#B42318]"],
    ]
    for (const [tone, bg, text] of cases) {
      const html = renderToStaticMarkup(
        <StatusPill label="Test" tone={tone as "neutral" | "pending" | "success" | "danger"} />
      )
      expect(html).toContain(bg)
      expect(html).toContain(text)
      expect(html).toContain("rounded-full")
    }
  })

  it("renders the decision-first merge labels and tones", () => {
    const cases: [string, string, string, string][] = [
      ["APPROVED", "PENDING", "Approuvée", "bg-[#E5F3EE]"],
      ["REJECTED", "MANAGER_REVIEW", "Rejetée", "bg-[#FBE9E9]"],
      ["WITHDRAWN", "MANAGER_REVIEW", "Retirée", "bg-[#F1F1EF]"],
      ["PENDING", "DRAFT", "Brouillon", "bg-[#F1F1EF]"],
      ["PENDING", "FINAL", "Finalisée", "bg-[#E5F3EE]"],
    ]
    for (const [decision, etape, label, bg] of cases) {
      const status = statusOf({ decision, etape })
      expect(status.label).toBe(label)
      const html = renderToStaticMarkup(
        <StatusPill label={status.label} tone={status.tone} />
      )
      expect(html).toContain(label)
      expect(html).toContain(bg)
    }
  })

  it("falls back to the etape label with the pending tone", () => {
    const status = statusOf({ decision: "PENDING", etape: "FINANCE_REVIEW" })
    expect(status.label).toBe("En attente (Finance)")
    expect(status.tone).toBe("pending")
  })
})
