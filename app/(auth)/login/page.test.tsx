import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/lib/auth/client", () => ({
  signInWithCredentials: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

const SOCIETE = {
  nom: "HAY 2010 SARL",
  logoUrl: null,
  faviconUrl: null,
  couleurPrimaire: null,
}

describe("LoginForm (Notion restyle, per #189)", () => {
  it("renders the centered column anatomy without a Card wrapper", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("w-[380px]")
    expect(html).toContain("max-w-full")
    expect(html).toContain("rounded-[10px]")
    expect(html).toContain("bg-primary")
    expect(html).toContain("HAY 2010 SARL")
    expect(html).toContain("Connectez-vous à votre espace de travail")
  })

  it("styles inputs hairline with the brand focus ring and primary buttons Notion-style", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain("h-9")
    expect(html).toContain("rounded-[3px]")
    expect(html).toContain("focus-visible:ring-1")
    expect(html).toContain("focus-visible:ring-(--brand)")
    expect(html).toContain("shadow-[0_1px_2px_rgba(15,15,15,0.1)]")
    expect(html).toContain("color-mix(in_oklab,var(--primary)_85%,black)")
    expect(html).toContain("Continuer")
  })

  it("keeps the divider, Google row and footer, without a sign-up link", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain(">Ou<")
    expect(html).toContain("Continuer avec Google")
    expect(html).toContain("Application de gestion des demandes de déplacement")
    expect(html).not.toContain("S'inscrire")
  })
})
