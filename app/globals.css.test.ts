import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

const css = readFileSync("app/globals.css", "utf8")

describe("design tokens (Notion remap, per #172)", () => {
  it("keeps the base-nova structure", () => {
    expect(css).toContain("@custom-variant dark")
    expect(css).toContain("@theme inline")
    expect(css).toContain("@layer base")
  })

  it("carries the Notion system font stack instead of Inter", () => {
    expect(css).toContain("--font-sans: -apple-system, BlinkMacSystemFont")
    expect(css).toContain('"Segoe UI"')
  })

  it("warms the light ink, muted, and hairline tokens", () => {
    expect(css).toContain("--foreground: oklch(0.329 0.011 91.7)")
    expect(css).toContain("--muted-foreground: oklch(0.569 0.005 91.5)")
    expect(css).toContain("--border: oklch(0.329 0.011 91.7 / 9%)")
    expect(css).toContain("--input: oklch(0.329 0.011 91.7 / 9%)")
    expect(css).toContain("--radius: 0.1875rem")
  })

  it("wires the --brand seam through primary, ring, and sidebar-primary", () => {
    expect(css).toContain("--brand: #0F766E")
    expect(css).toContain("--primary: var(--brand)")
    expect(css).toContain("--ring: var(--brand)")
    expect(css).toContain("--sidebar-primary: var(--brand)")
  })

  it("carries the warm dark palette", () => {
    expect(css).toContain(".dark")
    expect(css).toContain("--background: oklch(0.213 0 89.9)")
    expect(css).toContain("--card: oklch(0.244 0 89.9)")
    expect(css).toContain("--sidebar: oklch(0.244 0 89.9)")
    expect(css).toContain("--border: oklch(1 0 0 / 9%)")
    expect(css).toContain("--accent: oklch(1 0 0 / 5.5%)")
  })
})
