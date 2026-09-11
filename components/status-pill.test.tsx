import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { StatusPill } from "@/components/status-pill"
import type { PresentationTone } from "@/lib/demande-presentation"

// The label cases live with the presentation module
// (lib/demande-presentation.test.ts) — this suite pins rendering only.
describe("StatusPill", () => {
  it("renders the locked soft tones for each presentation tone", () => {
    const cases: [PresentationTone, string, string][] = [
      ["neutral", "bg-[#F1F1EF]", "text-[#37352F]"],
      ["pending", "bg-[#FBF0DB]", "text-[#8B5E0E]"],
      ["success", "bg-[#E5F3EE]", "text-[#0F6E4F]"],
      ["danger", "bg-[#FBE9E9]", "text-[#B42318]"],
    ]
    for (const [tone, bg, text] of cases) {
      const html = renderToStaticMarkup(<StatusPill label="Test" tone={tone} />)
      expect(html).toContain(bg)
      expect(html).toContain(text)
      expect(html).toContain("rounded-full")
    }
  })
})
