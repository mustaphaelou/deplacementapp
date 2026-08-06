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

describe("LoginForm (split-screen restyle, per prototype login-redesign)", () => {
  it("renders the 50/50 split-screen anatomy with a dark brand panel", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain("lg:grid-cols-2")
    expect(html).toContain("hidden flex-col justify-between")
    expect(html).toContain("bg-[#0B0F17]")
    expect(html).toContain("Accédez avec confiance")
    expect(html).toContain("HAY 2010 SARL")
  })

  it("shows the brand panel carousel with dots and the validation pipeline", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain("Circuit de validation clair")
    expect(html).toContain("Saisie simple et rapide")
    expect(html).toContain("Documents et PDF automatiques")
    expect(html).toContain('role="tablist"')
    expect(html).toContain("Manager")
    expect(html).toContain("Finance")
    expect(html).toContain("Direction")
  })

  it("renders the light form column with brand-ring inputs and the primary CTA", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain("Bienvenue")
    expect(html).toContain("Connectez-vous à votre espace de travail")
    expect(html).toContain("h-11")
    expect(html).toContain("focus-visible:ring-(--brand)/20")
    expect(html).toContain("Mot de passe oublié")
    expect(html).toContain("Se connecter")
  })

  it("keeps the divider, Google row and footer, without a sign-up link", async () => {
    const { LoginForm } = await import("./page")
    const html = renderToStaticMarkup(<LoginForm societe={SOCIETE} />)

    expect(html).toContain("Ou continuer avec")
    expect(html).toContain("Continuer avec Google")
    expect(html).toContain("Application de gestion des demandes de déplacement")
    expect(html).not.toContain("S'inscrire")
  })
})
