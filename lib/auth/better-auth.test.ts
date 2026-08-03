import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { eq, sql } from "drizzle-orm"
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs"
import fs from "fs"
import path from "path"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import * as schema from "../../db/schema"
import { account, session } from "../../db/schema/auth-tables"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { createAuth, BCRYPT_COST } from "./better-auth"
import { setPassword, CREDENTIAL_PROVIDER_ID } from "./set-password"
import {
  assertGoogleSignInAllowed,
  GOOGLE_VETO_REASONS,
} from "./google-guard"
import type { DrizzleDb } from "../../db"

const TIMEOUT = 30_000
const TEST_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
const SESSION_COOKIE = "better-auth.session_token"

type TestAuth = ReturnType<typeof createAuth>

function makeUtilisateur(overrides?: Partial<typeof schema.utilisateurs.$inferInsert>) {
  return {
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@acme.ma`,
    nom: "Dupont",
    prenom: "Jean",
    poste: "Développeur",
    role: "EMPLOYEE" as const,
    departementId: "",
    societeId: "",
    actif: true,
    googleAuthEnabled: true,
    creeLe: new Date("2026-01-01"),
    modifieLe: new Date("2026-01-01"),
    ...overrides,
  }
}

async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  )
  const b64 = Buffer.from(signature).toString("base64")
  return encodeURIComponent(`${value}.${b64}`)
}

async function cookieFor(token: string, secret: string = TEST_SECRET): Promise<string> {
  return `${SESSION_COOKIE}=${await signCookieValue(token, secret)}`
}

describe("better-auth adapter (T1 #164)", { timeout: TIMEOUT }, () => {
  let db: PgliteDb
  let auth: TestAuth
  let utilisateurId: string
  let email: string

  beforeAll(async () => {
    db = await createPgliteDb()
    auth = createAuth(db as unknown as DrizzleDb, {
      secret: TEST_SECRET,
      google: { clientId: "google-client-id", clientSecret: "google-secret" },
    })
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM session`)
    await db.execute(sql`DELETE FROM account`)
    await db.execute(sql`DELETE FROM utilisateurs`)
    await db.execute(sql`DELETE FROM departements`)
    await db.execute(sql`DELETE FROM societes`)

    const societeId = crypto.randomUUID()
    const departementId = crypto.randomUUID()
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

    utilisateurId = crypto.randomUUID()
    email = "jean.dupont@acme.ma"
    await db.insert(schema.utilisateurs).values(
      makeUtilisateur({
        id: utilisateurId,
        email,
        departementId,
        societeId,
      })
    )
  })

  describe("schema + migration (AC1)", () => {
    it("applies the session/account/verification tables from migration 0004", async () => {
      const token = "tok-0001"
      await db.insert(session).values({
        id: crypto.randomUUID(),
        token,
        expiresAt: new Date("2027-01-01"),
        userId: utilisateurId,
        updatedAt: new Date(),
      })
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: email,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId: utilisateurId,
        password: "$hashed$",
        updatedAt: new Date(),
      })
      await db.insert(schema.verification).values({
        id: crypto.randomUUID(),
        identifier: "token",
        value: "value",
        expiresAt: new Date("2027-01-01"),
        updatedAt: new Date(),
      })

      const sessionRows = await db.query.session.findMany()
      const accountRows = await db.query.account.findMany()
      const verificationRows = await db.query.verification.findMany()
      expect(sessionRows).toHaveLength(1)
      expect(sessionRows[0].token).toBe(token)
      expect(accountRows).toHaveLength(1)
      expect(accountRows[0].providerId).toBe(CREDENTIAL_PROVIDER_ID)
      expect(verificationRows).toHaveLength(1)
    })

    it("adds emailVerified to utilisateurs", async () => {
      const [row] = await db
        .select({ emailVerified: utilisateurs.emailVerified })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, utilisateurId))
        .limit(1)
      expect(row?.emailVerified).toBe(false)

      const verifiedId = crypto.randomUUID()
      const [seed] = await db
        .select({
          societeId: utilisateurs.societeId,
          departementId: utilisateurs.departementId,
        })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, utilisateurId))
        .limit(1)
      await db.insert(schema.utilisateurs).values(
        makeUtilisateur({
          id: verifiedId,
          email: "verifie@acme.ma",
          emailVerified: true,
          societeId: seed!.societeId,
          departementId: seed!.departementId,
        })
      )
      const [verified] = await db
        .select({ emailVerified: utilisateurs.emailVerified })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, verifiedId))
        .limit(1)
      expect(verified?.emailVerified).toBe(true)
    })

    it("keeps the core schema plugin-free (no admin/org tables)", () => {
      const exported = Object.keys(schema)
      for (const pluginTable of [
        "admin",
        "organization",
        "member",
        "invitation",
        "twoFactor",
        "rateLimit",
      ]) {
        expect(exported).not.toContain(pluginTable)
      }
    })

    it("migration 0004 creates the three auth tables and emailVerified", () => {
      const drizzleDir = path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        "../../drizzle"
      )
      const migrationFile = fs
        .readdirSync(drizzleDir)
        .find((f) => f.startsWith("0004_") && f.endsWith(".sql"))
      expect(migrationFile).toBeDefined()
      const sql = fs.readFileSync(path.join(drizzleDir, migrationFile!), "utf-8")
      expect(sql).toContain('CREATE TABLE "account"')
      expect(sql).toContain('CREATE TABLE "session"')
      expect(sql).toContain('CREATE TABLE "verification"')
      expect(sql).toContain('ALTER TABLE "utilisateurs" ADD COLUMN "emailVerified"')
    })
  })

  describe("adapter config (AC2)", () => {
    it("maps the user model onto the utilisateurs table", () => {
      expect(auth.options.user.modelName).toBe("utilisateurs")
      expect(auth.options.user.fields).toMatchObject({
        name: "nom",
        image: "avatarUrl",
        createdAt: "creeLe",
        updatedAt: "modifieLe",
      })
    })

    it("declares domain fields as server-owned additional fields", () => {
      const additional = auth.options.user.additionalFields
      for (const field of [
        "prenom",
        "poste",
        "role",
        "departementId",
        "actif",
        "googleAuthEnabled",
      ] as const) {
        expect(additional?.[field]?.input).toBe(false)
      }
    })

    it("closes the email+password pool (disableSignUp)", () => {
      expect(auth.options.emailAndPassword.disableSignUp).toBe(true)
    })

    it("hashes and verifies passwords with bcryptjs at cost 12", async () => {
      const { hash, verify } = auth.options.emailAndPassword.password
      const hashed = await hash("mot-de-passe-test")
      expect(hashed.startsWith("$2")).toBe(true)
      expect(hashed).toContain(`$12$`)
      await expect(verify({ hash: hashed, password: "mot-de-passe-test" })).resolves.toBe(true)
      await expect(verify({ hash: hashed, password: "mauvais" })).resolves.toBe(false)
      expect(BCRYPT_COST).toBe(12)
    })

    it("disables Google auto-provisioning", () => {
      expect(auth.options.socialProviders.google.disableImplicitSignUp).toBe(true)
    })

    it("registers nextCookies as the last plugin", () => {
      const plugins = auth.options.plugins ?? []
      expect(plugins.some((p) => p.id === "next-cookies")).toBe(true)
      expect(plugins.at(-1)?.id).toBe("next-cookies")
    })
  })

  describe("Google veto (AC3)", () => {
    it("refuses a sign-in for a missing Utilisateur", async () => {
      await expect(
        assertGoogleSignInAllowed(db as unknown as DrizzleDb, "inconnu@acme.ma")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: GOOGLE_VETO_REASONS.UTILISATEUR_INTROUVABLE,
      })
    })

    it("refuses a sign-in for a deactivated Utilisateur", async () => {
      await db
        .update(utilisateurs)
        .set({ actif: false })
        .where(eq(utilisateurs.id, utilisateurId))
      await expect(
        assertGoogleSignInAllowed(db as unknown as DrizzleDb, email)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: GOOGLE_VETO_REASONS.UTILISATEUR_DESACTIVE,
      })
    })

    it("refuses a sign-in for a Utilisateur without Google enabled", async () => {
      await db
        .update(utilisateurs)
        .set({ googleAuthEnabled: false })
        .where(eq(utilisateurs.id, utilisateurId))
      await expect(
        assertGoogleSignInAllowed(db as unknown as DrizzleDb, email)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: GOOGLE_VETO_REASONS.GOOGLE_NON_ACTIVE,
      })
    })

    it("allows an active, Google-enabled Utilisateur", async () => {
      await expect(
        assertGoogleSignInAllowed(db as unknown as DrizzleDb, email)
      ).resolves.toBeUndefined()
    })

    it("wires the veto into the configured Google mapProfileToUser", async () => {
      const mapProfile = auth.options.socialProviders.google.mapProfileToUser
      expect(typeof mapProfile).toBe("function")
      await expect(
        mapProfile!({ email: "inconnu@acme.ma" } as never)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: GOOGLE_VETO_REASONS.UTILISATEUR_INTROUVABLE,
      })
      await expect(mapProfile!({ email } as never)).resolves.toBeDefined()
    })
  })

  describe("setPassword (AC4)", () => {
    it("creates the credential row keyed on the current email", async () => {
      await setPassword(db as unknown as DrizzleDb, utilisateurId, "motdepasse-123")

      const rows = await db
        .select()
        .from(account)
        .where(eq(account.userId, utilisateurId))
      expect(rows).toHaveLength(1)
      expect(rows[0].providerId).toBe(CREDENTIAL_PROVIDER_ID)
      expect(rows[0].accountId).toBe(email)
      await expect(
        bcryptCompare("motdepasse-123", rows[0].password!)
      ).resolves.toBe(true)
    })

    it("upserts: a second call updates the single row, never duplicates", async () => {
      await setPassword(db as unknown as DrizzleDb, utilisateurId, "ancien-motdepasse")
      const before = await db
        .select({ id: account.id, password: account.password })
        .from(account)
        .where(eq(account.userId, utilisateurId))

      await setPassword(db as unknown as DrizzleDb, utilisateurId, "nouveau-motdepasse")

      const after = await db
        .select({ id: account.id, password: account.password })
        .from(account)
        .where(eq(account.userId, utilisateurId))
      expect(after).toHaveLength(1)
      expect(after[0].id).toBe(before[0].id)
      await expect(
        bcryptCompare("nouveau-motdepasse", after[0].password!)
      ).resolves.toBe(true)
      await expect(
        bcryptCompare("ancien-motdepasse", after[0].password!)
      ).resolves.toBe(false)
    })

    it("keeps the row identifier in sync when the email changes", async () => {
      const newEmail = "jean.renove@acme.ma"
      await db
        .update(utilisateurs)
        .set({ email: newEmail })
        .where(eq(utilisateurs.id, utilisateurId))

      await setPassword(db as unknown as DrizzleDb, utilisateurId, "motdepasse-123")

      const [row] = await db
        .select({ accountId: account.accountId })
        .from(account)
        .where(eq(account.userId, utilisateurId))
        .limit(1)
      expect(row?.accountId).toBe(newEmail)
    })

    it("throws for an unknown Utilisateur", async () => {
      await expect(
        setPassword(db as unknown as DrizzleDb, "inconnu", "motdepasse-123")
      ).rejects.toBeInstanceOf(Error)
    })
  })

  describe("email + password flows (AC5)", () => {
    it("signs in with a migrated bcrypt hash at cost 12", async () => {
      const migratedHash = await bcryptHash("motdepasse-herite", BCRYPT_COST)
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: email,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId: utilisateurId,
        password: migratedHash,
        updatedAt: new Date(),
      })

      const result = await auth.api.signInEmail({
        body: { email, password: "motdepasse-herite" },
        headers: new Headers({ origin: "http://localhost:3000" }),
      })
      expect(result.user.id).toBe(utilisateurId)
      expect(result.user.email).toBe(email)
      expect(result.user.name).toBe("Dupont")
      expect((result.user as any).role).toBe("EMPLOYEE")
      expect((result.user as any).actif).toBe(true)
      expect(typeof result.token).toBe("string")

      const sessionRows = await db.query.session.findMany()
      expect(sessionRows).toHaveLength(1)
      expect(sessionRows[0].userId).toBe(utilisateurId)
      expect(sessionRows[0].token).toBe(result.token)
    })

    it("rejects a wrong password", async () => {
      await setPassword(db as unknown as DrizzleDb, utilisateurId, "bon-motdepasse")
      await expect(
        auth.api.signInEmail({
          body: { email, password: "mauvais-motdepasse" },
          headers: new Headers({ origin: "http://localhost:3000" }),
        })
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(await db.query.session.findMany()).toHaveLength(0)
    })

    it("rejects self sign-up (closed pool)", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            email: "intrus@acme.ma",
            password: "motdepasse-123",
            name: "Intrus",
          },
          headers: new Headers({ origin: "http://localhost:3000" }),
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      const [intrus] = await db
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.email, "intrus@acme.ma"))
        .limit(1)
      expect(intrus).toBeUndefined()
      expect(await db.query.account.findMany()).toHaveLength(0)
    })
  })

  describe("sessions (AC5)", () => {
    async function signIn(): Promise<string> {
      await setPassword(db as unknown as DrizzleDb, utilisateurId, "motdepasse-123")
      const result = await auth.api.signInEmail({
        body: { email, password: "motdepasse-123" },
        headers: new Headers({ origin: "http://localhost:3000" }),
      })
      return result.token
    }

    it("creates, reads and revokes a session (round-trip)", async () => {
      const token = await signIn()
      const cookie = await cookieFor(token)

      const created = await db.query.session.findMany()
      expect(created).toHaveLength(1)
      expect(created[0].token).toBe(token)

      const sessionRes = await auth.api.getSession({
        headers: new Headers({ origin: "http://localhost:3000", cookie }),
      })
      expect(sessionRes).not.toBeNull()
      expect(sessionRes!.session.token).toBe(token)
      expect(sessionRes!.session.userId).toBe(utilisateurId)
      expect(sessionRes!.user.id).toBe(utilisateurId)
      expect(sessionRes!.user.email).toBe(email)
      expect((sessionRes!.user as any).role).toBe("EMPLOYEE")

      const signOutRes = await auth.api.signOut({
        headers: new Headers({ origin: "http://localhost:3000", cookie }),
      })
      expect(signOutRes).toEqual({ success: true })

      const after = await db.query.session.findMany()
      expect(after).toHaveLength(0)

      const stale = await auth.api.getSession({
        headers: new Headers({ origin: "http://localhost:3000", cookie }),
      })
      expect(stale).toBeNull()
    })

    it("returns null for a cookie without a session", async () => {
      const stray = await auth.api.getSession({
        headers: new Headers({
          origin: "http://localhost:3000",
          cookie: await cookieFor("token-inconnu"),
        }),
      })
      expect(stray).toBeNull()
    })
  })
})
