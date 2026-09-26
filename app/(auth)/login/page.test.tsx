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

/**
 * The engine-originated codes #247 maps: a Google-side or deployment condition,
 * each with its own message, pinned as literals.  Before #247 every one of them
 * rendered the generic fallback — the live `access_denied` (consent screen in
 * Testing, signing-in address not a test user) was indistinguishable from a bug
 * in the app.
 */
const ENGINE_MESSAGES = {
  access_denied:
    "Google a refusé l'autorisation de connexion. Si vous n'avez pas été autorisé dans la configuration Google de l'application, contactez votre administrateur.",
  invalid_code:
    "Le code d'autorisation renvoyé par Google est invalide ou a expiré. Réessayez de vous connecter avec Google.",
  state_mismatch:
    "La session de connexion Google a expiré ou a été remplacée par une autre tentative. Relancez la connexion Google.",
  state_not_found:
    "La connexion Google n'a pas pu être vérifiée : aucune session de connexion n'a été reçue. Relancez la connexion Google.",
  invalid_callback_request:
    "L'adresse de retour de la connexion Google est mal configurée sur ce serveur. Contactez votre administrateur.",
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
  refusalCode?: string | null
}) {
  const { LoginForm } = await import("./page")
  return renderToStaticMarkup(<LoginForm societe={SOCIETE} {...props} />)
}

describe("LoginForm (Cloudflare single-column restyle, #245)", () => {
  it("drops the split screen and centres one narrow column", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    // The 50/50 split-screen and its dark brand panel are gone.
    expect(html).not.toContain("lg:grid-cols-2")
    expect(html).not.toContain("bg-[#0B0F17]")
    expect(html).not.toContain("Accédez avec confiance")
    // ...and the feature carousel with it.
    expect(html).not.toContain("Circuit de validation clair")
    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain("Direction")

    // One centred column, ~348px, on a full-height muted surface.
    expect(html).toContain("min-h-dvh")
    expect(html).toContain("max-w-[348px]")
    expect(html).toContain("justify-center")
  })

  it("puts the brand mark above the heading, both centred", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("HAY 2010 SARL")
    expect(html).toContain("Connectez-vous à votre espace")
    // The mark precedes the heading.
    expect(html.indexOf("HAY 2010 SARL")).toBeLessThan(
      html.indexOf("Connectez-vous à votre espace")
    )
    expect(html).toContain("text-center")
  })

  it("orders the rows: Google, divider, credentials, CTA, footer", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    const google = html.indexOf("Continuer avec Google")
    const divider = html.indexOf(">ou<")
    const email = html.indexOf('id="email"')
    const cta = html.indexOf("Se connecter")
    const footer = html.indexOf("Contactez votre administrateur")

    expect(google).toBeGreaterThan(-1)
    expect(divider).toBeGreaterThan(-1)
    expect(email).toBeGreaterThan(-1)
    expect(cta).toBeGreaterThan(-1)
    expect(footer).toBeGreaterThan(-1)
    expect(google).toBeLessThan(divider)
    expect(divider).toBeLessThan(email)
    expect(email).toBeLessThan(cta)
    expect(cta).toBeLessThan(footer)
  })

  it("uses the Cloudflare control geometry: 36px, hairline, 5px radius", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("h-9") // 36px inputs and buttons
    expect(html).toContain("rounded-[5px]")
    expect(html).toContain("text-[13px]")
    // Not the 44px controls of the previous restyle.
    expect(html).not.toContain("h-11")
  })

  it("rings the focus in the Societe's primary colour, not a hardcoded one", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("(--brand)")
    expect(html).not.toContain("#0F766E")
  })

  it("carries the remember-me checkbox and the forgot link on one row", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain('type="checkbox"')
    expect(html).toContain("Se souvenir de moi")
    expect(html).toContain("Mot de passe oublié")
    // The toggle lives inside the field and names its action.  Only one of the
    // two labels renders at a time — the initial state is "show".
    expect(html).toMatch(/aria-label="(Afficher|Masquer) le mot de passe"/)
  })

  it("renders a full-width near-black primary CTA and the legal line", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain("Se connecter")
    expect(html).toContain("w-full")
    expect(html).toContain("bg-slate-900")
    expect(html).toContain("Application de gestion des demandes de déplacement")
  })

  it("honours the dark theme with page-specific rules, not a white surface", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    // The page's OWN dark rules.  Asserting a bare "dark:" would pass on the
    // Button's base `dark:aria-invalid:*` variants and prove nothing.
    expect(html).toContain("dark:bg-slate-100")
    expect(html).toContain("dark:bg-background")
    // The surface is a theme token, not the hardcoded white the old form
    // column carried.  (No `bg-white` negative here: the CTA legitimately
    // carries `dark:hover:bg-white`.  A `className=` assertion would also be
    // vacuous — renderToStaticMarkup emits `class=`.)
    expect(html).toContain("bg-muted/40")
  })

  it("ticks remember-me by default, so the default sign-in stays long-lived", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    // The engine's sign-in schema is `rememberMe: z.boolean().default(true)`
    // and it calls `createSession(userId, rememberMe === false)`.  A box that
    // rendered unticked would send `false` and silently drop every session —
    // and the setup wizard's — from long-lived to 24h.
    expect(html).toMatch(/type="checkbox"[^>]*checked/)
  })
})

describe("validateCredentials (pure, #245)", () => {
  it("accepts a well-formed e-mail and a password", async () => {
    const { validateCredentials } = await import("./page")

    expect(validateCredentials("vous@exemple.ma", "secret")).toEqual({})
  })

  it("reports the empty e-mail, a malformed e-mail and the empty password", async () => {
    const { validateCredentials } = await import("./page")

    expect(validateCredentials("", "secret")).toEqual({
      email: "Veuillez saisir votre email.",
    })
    expect(validateCredentials("pas-un-email", "secret")).toEqual({
      email: "Adresse email invalide.",
    })
    expect(validateCredentials("vous@exemple.ma", "")).toEqual({
      password: "Veuillez saisir votre mot de passe.",
    })
  })

  it("reports both fields at once", async () => {
    const { validateCredentials } = await import("./page")

    expect(validateCredentials("", "")).toEqual({
      email: "Veuillez saisir votre email.",
      password: "Veuillez saisir votre mot de passe.",
    })
  })
})

describe("Google section visibility (connexionGoogle)", () => {
  it("renders the divider, Google row and footer when connexionGoogle is true", async () => {
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).toContain(">ou<")
    expect(html).toContain("Continuer avec Google")
    expect(html).toContain("Application de gestion des demandes de déplacement")
    expect(html).not.toContain("S'inscrire")
  })

  it("renders nothing Google-related when connexionGoogle is false", async () => {
    const html = await renderLoginForm({ connexionGoogle: false })

    expect(html).not.toContain("Google")
    expect(html).not.toContain(">ou<")
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

  // ---- #247: the code survives exactly when the app could not name it
  it("strips a mapped engine code, which has already been rendered", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(
      stripRefusalParams(
        "/login?error=access_denied&error_description=Access+denied&next=%2Fdemandes"
      )
    ).toBe("/login?next=%2Fdemandes")
  })

  it("keeps an unmapped code in the URL, so it can be pasted into a bug report", async () => {
    const { stripRefusalParams } = await import("./page")

    // The fallback message is the only thing an end user could see for this
    // code, and it names nothing.  Destroying the parameter at mount would
    // leave the one diagnostic artefact unrecoverable without a live probe.
    expect(
      stripRefusalParams(
        "/login?error=unable_to_get_user_info&error_description=boom&next=%2Fdemandes"
      )
    ).toBe(
      "/login?error=unable_to_get_user_info&error_description=boom&next=%2Fdemandes"
    )
  })

  it("keeps a bare unmapped code even without a description", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(stripRefusalParams("/login?error=some_future_engine_code")).toBe(
      "/login?error=some_future_engine_code"
    )
  })

  it("keeps an unmapped code even when it arrives as an absolute href", async () => {
    const { stripRefusalParams } = await import("./page")

    expect(
      stripRefusalParams("https://app.exemple.ma/login?error=weird_code#form")
    ).toBe("https://app.exemple.ma/login?error=weird_code#form")
  })

  it("keeps a mapped-code decision independent of the description", async () => {
    const { stripRefusalParams } = await import("./page")

    // The code is the decision: recognised → rendered → zombie, stripped.
    expect(
      stripRefusalParams("/login?error=state_not_found&error_description=x")
    ).toBe("/login")
  })
})

describe("googleRefusalFromSearch (engine vocabulary, #247)", () => {
  it.each(Object.entries(ENGINE_MESSAGES))(
    "maps %s to its own message, never the fallback",
    async (code, message) => {
      const { googleRefusalFromSearch } = await import("./page")

      expect(googleRefusalFromSearch(`?error=${code}`)).toBe(message)
      expect(googleRefusalFromSearch(`?error=${code}`)).not.toBe(
        MESSAGES.fallback
      )
    }
  )

  it("gives each engine code a distinct message", async () => {
    const { googleRefusalFromSearch } = await import("./page")
    const messages = Object.keys(ENGINE_MESSAGES).map((code) =>
      googleRefusalFromSearch(`?error=${code}`)
    )

    expect(new Set(messages).size).toBe(messages.length)
  })

  it("still falls back for a genuinely unknown code", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    expect(googleRefusalFromSearch("?error=some_future_engine_code")).toBe(
      MESSAGES.fallback
    )
    expect(googleRefusalFromSearch("?error=")).toBe(MESSAGES.fallback)
  })

  it("reads the engine's own access_denied straight from a real refusal", async () => {
    const { googleRefusalFromSearch } = await import("./page")

    // Reproduced live on 2026-09-26: the consent screen in Testing rejects a
    // non-test-user address, and the engine forwards Google's own code.
    expect(
      googleRefusalFromSearch(
        "?error=access_denied&error_description=The+user+denied+the+request."
      )
    ).toBe(ENGINE_MESSAGES.access_denied)
  })
})

describe("the raw code in the UI (#247)", () => {
  it("shows the raw code next to the message outside production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { googleRefusalFromSearch } = await import("./page")
    const html = await renderLoginForm({
      connexionGoogle: true,
      refusalMessage: googleRefusalFromSearch("?error=access_denied"),
      refusalCode: "access_denied",
    })

    // A developer must be able to read the code verbatim.  The debug hook is
    // asserted, not the bare string: a reworded French message could stop
    // containing the code for reasons that have nothing to do with this.
    expect(html).toContain('data-refusal-code="true"')
    expect(renderedText(html)).toContain("access_denied")
    expect(renderedText(html)).toContain(ENGINE_MESSAGES.access_denied)
    vi.unstubAllEnvs()
  })

  it("never shows the raw code in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { googleRefusalFromSearch } = await import("./page")
    const html = await renderLoginForm({
      connexionGoogle: true,
      refusalMessage: googleRefusalFromSearch("?error=access_denied"),
      refusalCode: "access_denied",
    })

    // …and an end user sees the French copy alone: no debug hook at all, and
    // the code nowhere in the markup.
    expect(html).not.toContain('data-refusal-code="true"')
    expect(renderedText(html)).not.toContain("access_denied")
    expect(renderedText(html)).toContain(ENGINE_MESSAGES.access_denied)
    vi.unstubAllEnvs()
  })

  it("renders no debug line when the page was not reached through a refusal", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const html = await renderLoginForm({ connexionGoogle: true })

    expect(html).not.toContain('role="alert"')
    vi.unstubAllEnvs()
  })
})
