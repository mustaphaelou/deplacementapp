/**
 * The Google callback seam — the regression suite for the shipped defects of
 * #201 (a Google sign-in that dead-ended, a refusal that answered raw JSON).
 *
 * It drives the whole Google dance against the real auth instance over PGlite:
 * OAuth state is minted through the engine's sign-in endpoint, the Google
 * token exchange is stubbed at the network boundary, a synthetic id_token is
 * served in its response, and the callback is invoked through `auth.handler`.
 *
 * Assertions target only externals — the redirect (status, target, codes), the
 * session cookie and the rows the callback leaves behind.  Every refusal must
 * be a redirect carrying its code; a 200 JSON body is the defect this suite
 * exists to catch.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { sql } from "drizzle-orm"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import * as schema from "../../db/schema"
import { createAuth } from "./better-auth"
import type { DrizzleDb } from "../../db"
import { account } from "../../db/schema/auth-tables"
import { GOOGLE_REFUSAL_CODES, googleRefusalMessage } from "./google-refusals"
import type { GoogleRefusalCode } from "./google-refusals"

const TIMEOUT = 30_000
const TEST_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
const BASE_URL = "http://localhost:3000"
const GOOGLE = {
  clientId: "test-google-client-id",
  clientSecret: "test-google-client-secret",
}
const SESSION_COOKIE = "better-auth.session_token"

type TestAuth = ReturnType<typeof createAuth>

// The app's createAuth reads the base URL from the environment (production
// sets it); the callback flow needs it to mint state and resolve cookies.
process.env.BETTER_AUTH_URL = BASE_URL

// ---------------------------------------------------------------- Google stub
let idToken = ""
const interceptedUrls: string[] = []

/** Serve the Google token exchange at the network boundary; pass everything
 * else through.  The callback decodes the id_token from that response — no
 * JWKS call happens on this path, the signature is not verified. */
function installGoogleStub(): () => void {
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    interceptedUrls.push(url)
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "stub-access-token",
          refresh_token: "stub-refresh-token",
          id_token: idToken,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid email profile",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    }
    return realFetch(input, init)
  }) as typeof fetch
  return () => {
    globalThis.fetch = realFetch
  }
}

function base64url(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

/** A synthetic Google id_token.  `email_verified: true` is required for the
 * first-time link (the engine refuses to link an unverified provider e-mail);
 * `sub` becomes the Google account id. */
function makeIdToken({
  sub,
  email,
  emailVerified = true,
  name = "Utilisateur Test",
}: {
  sub: string
  email: string
  emailVerified?: boolean
  name?: string
}): string {
  const now = Math.floor(Date.now() / 1000)
  return [
    base64url({ alg: "RS256", kid: "test-kid", typ: "JWT" }),
    base64url({
      iss: "https://accounts.google.com",
      aud: GOOGLE.clientId,
      sub,
      email,
      email_verified: emailVerified,
      name,
      iat: now,
      exp: now + 3600,
    }),
    "test-signature-not-verified",
  ].join(".")
}

describe("Google callback seam (#203)", { timeout: TIMEOUT }, () => {
  let db: PgliteDb
  let auth: TestAuth
  let societeId: string
  let departementId: string
  let restoreFetch: () => void

  beforeAll(async () => {
    db = await createPgliteDb()
    auth = createAuth(db as unknown as DrizzleDb, {
      secret: TEST_SECRET,
      google: GOOGLE,
    })
    restoreFetch = installGoogleStub()
  })

  afterAll(() => {
    restoreFetch()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM session`)
    await db.execute(sql`DELETE FROM account`)
    await db.execute(sql`DELETE FROM utilisateurs`)
    await db.execute(sql`DELETE FROM verification`)
    await db.execute(sql`DELETE FROM departements`)
    await db.execute(sql`DELETE FROM societes`)

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    await db.insert(schema.societes).values({
      id: societeId,
      nom: "Acme",
      modifieLe: new Date(),
    })
    await db.insert(schema.departements).values({
      id: departementId,
      nom: "RH",
      societeId,
    })
    idToken = ""
    interceptedUrls.length = 0
  })

  // ------------------------------------------------------------ harness
  async function seedUtilisateur({
    email,
    emailVerified = true,
    actif = true,
    googleAuthEnabled = true,
  }: {
    email: string
    emailVerified?: boolean
    actif?: boolean
    googleAuthEnabled?: boolean
  }): Promise<string> {
    const id = crypto.randomUUID()
    await db.insert(schema.utilisateurs).values({
      id,
      email,
      emailVerified,
      actif,
      googleAuthEnabled,
      nom: "Dupont",
      prenom: "Jean",
      poste: "Développeur",
      role: "EMPLOYEE",
      departementId,
      societeId,
      creeLe: new Date("2026-01-01"),
      modifieLe: new Date("2026-01-01"),
    })
    return id
  }

  async function seedGoogleAccount(
    userId: string,
    accountId: string
  ): Promise<void> {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId,
      providerId: "google",
      userId,
      updatedAt: new Date(),
    })
  }

  /** Mint OAuth state through the engine's sign-in endpoint, exactly as the
   * browser does, and carry its cookies through to the callback. */
  async function mintState(): Promise<{ state: string; cookie: string }> {
    const res = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin: BASE_URL, "content-type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/",
          errorCallbackURL: "/login",
          requestSignUp: true,
        }),
      })
    )
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")
    expect(state).toBeTruthy()
    const cookie = res.headers
      .getSetCookie()
      .map((setCookie) => setCookie.split(";")[0])
      .join("; ")
    return { state: state as string, cookie }
  }

  async function invokeCallback({
    code,
    state,
    cookie,
  }: {
    code: string
    state: string
    cookie: string
  }): Promise<Response> {
    const query = new URLSearchParams({ code, state })
    return auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/google?${query}`, {
        headers: { origin: BASE_URL, cookie },
        redirect: "manual",
      })
    )
  }

  function redirectFrom(res: Response) {
    const location = res.headers.get("location")
    expect(location).toBeTruthy()
    const url = new URL(location as string, BASE_URL)
    return {
      location: location as string,
      pathname: url.pathname,
      error: url.searchParams.get("error"),
      errorDescription: url.searchParams.get("error_description"),
    }
  }

  function hasSessionCookie(res: Response): boolean {
    return res.headers.getSetCookie().some((cookie) => {
      const [nameValue] = cookie.split(";")
      const [name, value] = nameValue.split("=")
      return name === SESSION_COOKIE && Boolean(value)
    })
  }

  /** A refusal is a 302 redirect carrying its code and the mapped French
   * message — never a 200 JSON body, never a session. */
  async function expectRefusalRedirect(res: Response, code: GoogleRefusalCode) {
    expect(res.status).toBe(302)
    expect(res.status).not.toBe(200)
    // The defect was a 200 JSON body; a refusal carries no body at all.
    expect(await res.text()).toBe("")

    const redirect = redirectFrom(res)
    expect(redirect.pathname).toBe("/login")
    expect(redirect.error).toBe(code)
    expect(redirect.errorDescription).toBe(googleRefusalMessage(code))
    expect(redirect.errorDescription!.length).toBeGreaterThan(0)
    expect(hasSessionCookie(res)).toBe(false)
  }

  // ------------------------------------------------------------ happy paths
  it("links an enabled Utilisateur's Google identity and issues a session", async () => {
    const utilisateurId = await seedUtilisateur({ email: "alice@acme.ma" })
    idToken = makeIdToken({ sub: "google-sub-alice", email: "alice@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "enabled-first-sign-in",
      state,
      cookie,
    })

    expect(res.status).toBe(302)
    const redirect = redirectFrom(res)
    expect(redirect.pathname).toBe("/")
    expect(redirect.error).toBeNull()

    expect(hasSessionCookie(res)).toBe(true)
    const sessions = await db.query.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].userId).toBe(utilisateurId)

    const accounts = await db.query.account.findMany()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].providerId).toBe("google")
    expect(accounts[0].accountId).toBe("google-sub-alice")
    expect(accounts[0].userId).toBe(utilisateurId)

    const utilisateurs = await db.query.utilisateurs.findMany()
    expect(utilisateurs).toHaveLength(1)

    // The stubbed token exchange is the only network call the callback makes.
    expect(interceptedUrls).toHaveLength(1)
    expect(interceptedUrls[0]).toContain("oauth2.googleapis.com/token")
  })

  it("signs in a returning Utilisateur without duplicating the linked account", async () => {
    const utilisateurId = await seedUtilisateur({ email: "alice@acme.ma" })
    await seedGoogleAccount(utilisateurId, "google-sub-alice")
    idToken = makeIdToken({ sub: "google-sub-alice", email: "alice@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "enabled-returning-sign-in",
      state,
      cookie,
    })

    expect(res.status).toBe(302)
    expect(redirectFrom(res).pathname).toBe("/")
    expect(hasSessionCookie(res)).toBe(true)

    const sessions = await db.query.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].userId).toBe(utilisateurId)

    const accounts = await db.query.account.findMany()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].accountId).toBe("google-sub-alice")

    expect(await db.query.utilisateurs.findMany()).toHaveLength(1)
  })

  it("signs in despite the stored e-mail's capitalization", async () => {
    const utilisateurId = await seedUtilisateur({
      email: "Jean.Dupont@Acme.ma",
    })
    await seedGoogleAccount(utilisateurId, "google-sub-jean")
    idToken = makeIdToken({
      sub: "google-sub-jean",
      email: "jean.dupont@acme.ma",
    })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "case-insensitive-sign-in",
      state,
      cookie,
    })

    // The gate must find the Utilisateur case-insensitively; a case-sensitive
    // lookup would refuse with utilisateur_introuvable.
    expect(res.status).toBe(302)
    expect(redirectFrom(res).pathname).toBe("/")
    expect(hasSessionCookie(res)).toBe(true)
    const sessions = await db.query.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].userId).toBe(utilisateurId)
  })

  it("links despite the provider e-mail's capitalization", async () => {
    const utilisateurId = await seedUtilisateur({ email: "alice@acme.ma" })
    idToken = makeIdToken({
      sub: "google-sub-alice",
      email: "Alice@Acme.ma",
    })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "provider-case-first-sign-in",
      state,
      cookie,
    })

    expect(res.status).toBe(302)
    expect(redirectFrom(res).pathname).toBe("/")
    expect(hasSessionCookie(res)).toBe(true)
    const sessions = await db.query.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].userId).toBe(utilisateurId)
    const accounts = await db.query.account.findMany()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].providerId).toBe("google")
    expect(accounts[0].accountId).toBe("google-sub-alice")
  })

  // ------------------------------------------------------------ refusals
  it("refuses an unknown e-mail with utilisateur_introuvable, leaving no session and no rows", async () => {
    idToken = makeIdToken({
      sub: "google-sub-stranger",
      email: "stranger@example.com",
    })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({ code: "unknown", state, cookie })

    await expectRefusalRedirect(
      res,
      GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE
    )
    expect(await db.query.session.findMany()).toHaveLength(0)
    expect(await db.query.utilisateurs.findMany()).toHaveLength(0)
    expect(await db.query.account.findMany()).toHaveLength(0)
  })

  it("refuses a deactivated Utilisateur with utilisateur_desactive", async () => {
    await seedUtilisateur({ email: "bob@acme.ma", actif: false })
    idToken = makeIdToken({ sub: "google-sub-bob", email: "bob@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({ code: "deactivated", state, cookie })

    await expectRefusalRedirect(res, GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE)
    expect(await db.query.session.findMany()).toHaveLength(0)
    expect(await db.query.utilisateurs.findMany()).toHaveLength(1)
    expect(await db.query.account.findMany()).toHaveLength(0)
  })

  it("refuses a Utilisateur without Google enabled with google_non_active", async () => {
    await seedUtilisateur({ email: "carol@acme.ma", googleAuthEnabled: false })
    idToken = makeIdToken({ sub: "google-sub-carol", email: "carol@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({ code: "not-enabled", state, cookie })

    await expectRefusalRedirect(res, GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE)
    expect(await db.query.session.findMany()).toHaveLength(0)
    expect(await db.query.utilisateurs.findMany()).toHaveLength(1)
    expect(await db.query.account.findMany()).toHaveLength(0)
  })

  it("refuses a returning deactivated Utilisateur at the sign-in gate", async () => {
    const utilisateurId = await seedUtilisateur({
      email: "bob@acme.ma",
      actif: false,
    })
    await seedGoogleAccount(utilisateurId, "google-sub-bob")
    idToken = makeIdToken({ sub: "google-sub-bob", email: "bob@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "deactivated-returning",
      state,
      cookie,
    })

    await expectRefusalRedirect(res, GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE)
    expect(await db.query.session.findMany()).toHaveLength(0)
    expect(await db.query.utilisateurs.findMany()).toHaveLength(1)
    expect(await db.query.account.findMany()).toHaveLength(1)
  })

  it("refuses a returning Utilisateur whose Google access was switched off", async () => {
    const utilisateurId = await seedUtilisateur({
      email: "carol@acme.ma",
      googleAuthEnabled: false,
    })
    await seedGoogleAccount(utilisateurId, "google-sub-carol")
    idToken = makeIdToken({ sub: "google-sub-carol", email: "carol@acme.ma" })

    const { state, cookie } = await mintState()
    const res = await invokeCallback({
      code: "not-enabled-returning",
      state,
      cookie,
    })

    await expectRefusalRedirect(res, GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE)
    expect(await db.query.session.findMany()).toHaveLength(0)
    expect(await db.query.utilisateurs.findMany()).toHaveLength(1)
    expect(await db.query.account.findMany()).toHaveLength(1)
  })
})
