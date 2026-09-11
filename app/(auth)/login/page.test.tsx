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

/** The decided French messages of spec #201, pinned as literals. */
const MESSAGES = {
  utilisateur_introuvable:
    "Aucun compte ne correspond à cette adresse Google. Utilisez votre adresse professionnelle ou contactez votre administrateur.",
  utilisateur_desactive:
    "Votre compte est désactivé. Contactez votre administrateur.",
  google_non_active:
    "La connexion Google n'est pas activée pour votre compte. Contactez votre administrateur.",
  fallback:
    "La connexion avec Google a échoué. Réessayez ou contactez votre administrateur.",
}

/** The refusal outcomes with the search string the engine redirects with. */
const REFUSALS = [
  {
    outcome: "utilisateur_introuvable",
    search:
      "?error=utilisateur_introuvable&error_description=Aucun+compte+ne+correspond+%C3%A0+cette+adresse+Google.+Utilisez+votre+adresse+professionnelle+ou+contactez+votre+administrateur.",
    message: MESSAGES.utilisateur_introuvable,
  },
  {
    outcome: "utilisateur_desactive",
    search:
      "?error=utilisateur_desactive&error_description=Votre+compte+est+d%C3%A9sactiv%C3%A9.+Contactez+votre+administrateur.",
    message: MESSAGES.utilisateur_desactive,
  },
  {
    outcome: "google_non_active",
    search:
      "?error=google_non_active&error_description=La+connexion+Google+n%27est+pas+activ%C3%A9e+pour+votre+compte.+Contactez+votre+administrateur.",
    message: MESSAGES.google_non_active,
  },
  {
    outcome: "an engine code outside the vocabulary",
    search: "?error=account_not_linked",
    message: MESSAGES.fallback,
  },
]

/**
 * renderToStaticMarkup escapes text entities (`'` → `&#x27;`); decoding before
 * comparing pins the French message itself, not React's escaping.
 */
function renderedText(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

async function renderLoginForm(props: {
  connexionGoogle: boolean
  refusalMessage?: string | null
}) {
  const { LoginForm } = await import("./page")
  return renderToStaticMarkup(<LoginForm societe={SOCIETE} {...props} />)
}

describe("LoginForm (split-screen restyle, per prototype login-redesign)", () => {
  it("renders the 50/50 split-screen anatomy with a dark brand panel", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("lg:grid-cols-2")
    expect(html).toContain("hidden flex-col justify-between")
    expect(html).toContain("bg-[#0B0F17]")
    expect(html).toContain("Accédez avec confiance")
    expect(html).toContain("HAY 2010 SARL")
  })

  it("shows the brand panel carousel with dots and the validation pipeline", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("Circuit de validation clair")
    expect(html).toContain("Saisie simple et rapide")
    expect(html).toContain("Documents et PDF automatiques")
    expect(html).toContain('role="tablist"')
    expect(html).toContain("Manager")
    expect(html).toContain("Finance")
    expect(html).toContain("Direction")
  })

  it("renders the light form column with brand-ring inputs and the primary CTA", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("Bienvenue")
    expect(html).toContain("Connectez-vous à votre espace de travail")
    expect(html).toContain("h-11")
    expect(html).toContain("focus-visible:ring-(--brand)/20")
    expect(html).toContain("Mot de passe oublié")
    expect(html).toContain("Se connecter")
  })
})

describe("Google section visibility (connexionGoogle)", () => {
  it("renders the divider, Google row and footer when connexionGoogle is true", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("Ou continuer avec")
    expect(html).toContain("Continuer avec Google")
    expect(html).toContain("Application de gestion des demandes de déplacement")
    expect(html).not.toContain("S'inscrire")
  })

  it("renders nothing Google-related when connexionGoogle is false", async () => {
    const html = await renderLoginForm({ connexionGoogle: false })

    expect(html).not.toContain("Google")
    expect(html).not.toContain("Ou continuer avec")
    // ...and the rest of the form column is intact.
    expect(html).toContain("Se connecter")
    expect(html).toContain("Application de gestion des demandes de déplacement")
  })
})

describe("refusal alert (rendered per outcome)", () => {
  it.each(REFUSALS)(
    "renders the alert for $outcome",
    async ({ search, message }) => {
      const { googleRefusalFromSearch } = await import("./page")
      const html = await renderLoginForm({
        connexionGoogle: true,
        refusalMessage: googleRefusalFromSearch(search),
      })

      expect(html).toContain('role="alert"')
      expect(renderedText(html)).toContain(message)
    }
  )

  it("renders no alert when the URL carried no refusal", async () => {
    const { googleRefusalFromSearch } = await import("./page")
    const html = await renderLoginForm({
      connexionGoogle: true,
      refusalMessage: googleRefusalFromSearch("?next=%2Fdemandes"),
    })

    expect(html).not.toContain('role="alert"')
  })
})

describe("googleRefusalFromSearch (message mapping, pure)", () => {
  it("maps each gate refusal code to its decided French message", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    expect(googleRefusalFromSearch("?error=utilisateur_introuvable")).toBe(
      MESSAGES.utilisateur_introuvable
    )
    expect(googleRefusalFromSearch("?error=utilisateur_desactive")).toBe(
      MESSAGES.utilisateur_desactive
    )
    expect(googleRefusalFromSearch("?error=google_non_active")).toBe(
      MESSAGES.google_non_active
    )
  })

  it("falls back for engine codes outside the vocabulary", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    expect(googleRefusalFromSearch("?error=signup_disabled")).toBe(
      MESSAGES.fallback
    )
    expect(googleRefusalFromSearch("?error=account_not_linked")).toBe(
      MESSAGES.fallback
    )
    expect(googleRefusalFromSearch("?error=validation_failed")).toBe(
      MESSAGES.fallback
    )
  })

  it("returns null when the URL carries no error parameter", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    expect(googleRefusalFromSearch("")).toBeNull()
    expect(googleRefusalFromSearch("?next=%2Fdemandes")).toBeNull()
  })

  it("reads a search string with or without the leading '?'", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    expect(googleRefusalFromSearch("error=utilisateur_desactive")).toBe(
      MESSAGES.utilisateur_desactive
    )
  })
})

describe("stripRefusalParams (no zombie parameter, pure)", () => {
  it("removes error and error_description while preserving other parameters", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(
      stripRefusalParams(
        "/login?error=utilisateur_desactive&error_description=Votre+compte+est+d%C3%A9sactiv%C3%A9.+Contactez+votre+administrateur.&next=%2Fdemandes"
      )
    ).toBe("/login?next=%2Fdemandes")
  })

  it("cleans an absolute href and keeps the hash", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(
      stripRefusalParams(
        "https://app.exemple.ma/login?error=google_non_active&error_description=x#form"
      )
    ).toBe("/login#form")
  })

  it("is a no-op on hrefs without refusal parameters", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(stripRefusalParams("/login?next=%2Fdemandes#form")).toBe(
      "/login?next=%2Fdemandes#form"
    )
    expect(stripRefusalParams("/login")).toBe("/login")
  })

  it("strips error_description even when the engine omitted error", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(stripRefusalParams("/login?error_description=orphan")).toBe("/login")
  })
})
