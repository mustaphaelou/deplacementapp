import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeToggle } from "@/components/theme-toggle"

describe("ThemeToggle", () => {
  it("renders a labelled toggle button defaulting to the light state", () => {
    const html = renderToStaticMarkup(<ThemeToggle />)
    expect(html).toContain("Passer en mode sombre")
    expect(html).toContain('aria-label="Passer en mode sombre"')
    expect(html).toContain("<button")
  })
})
