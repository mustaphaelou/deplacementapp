import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/lib/auth/client", () => ({
  signInWithCredentials: vi.fn(),
}))

describe("SetupWizard (Notion restyle, per #189)", () => {
  it("renders the centered column anatomy without a Card wrapper", async () => {
    const { SetupWizard } = await import("./setup-wizard")
    const html = renderToStaticMarkup(<SetupWizard />)

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("w-[420px]")
    expect(html).toContain("max-w-full")
    expect(html).toContain("Configuration initiale")
    expect(html).toContain("Informations de la société (1/3)")
  })

  it("styles inputs and primary buttons with the auth treatment", async () => {
    const { SetupWizard } = await import("./setup-wizard")
    const html = renderToStaticMarkup(<SetupWizard />)

    expect(html).toContain("rounded-[3px]")
    expect(html).toContain("focus-visible:ring-1")
    expect(html).toContain("focus-visible:ring-(--brand)")
    expect(html).toContain("shadow-[0_1px_2px_rgba(15,15,15,0.1)]")
    expect(html).toContain("color-mix(in_oklab,var(--primary)_85%,black)")
    expect(html).toContain("Continuer")
  })
})
