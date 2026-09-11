import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { eq, sql } from "drizzle-orm"
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import fs from "fs"
import path from "path"
import { createPgliteDb } from "../test/create-pglite-db"
import type { PgliteDb } from "../test/create-pglite-db"
import { migrationTags, loadAndCleanSql } from "../test/create-pglite-db"
import * as schema from "../../db/schema"
import { account, session } from "../../db/schema/auth-tables"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { createAuth, BCRYPT_COST } from "./better-auth"
import { setPassword, CREDENTIAL_PROVIDER_ID } from "./set-password"
import { GOOGLE_REFUSAL_CODES, googleRefusalMessage } from "./google-refusals"
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
        accountId: utilisateurId,
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

  describe("credential re-key migration (#202)", { timeout: TIMEOUT }, () => {
    it("re-keys legacy e-mail-keyed credential rows onto the Utilisateur id and keeps sign-in green", async () => {
      const client = await PGlite.create()
      const tags = migrationTags()
      const rekeyTag = tags.find((tag) => tag.includes("rekey_credential"))
      expect(rekeyTag).toBeDefined()
      const rekeyIdx = tags.indexOf(rekeyTag!)

      // Apply the migrations as they stood before the re-key (same apply
      // semantics as the PGlite harness, including the skip of statements
      // that fail on a fresh database).
      for (const tag of tags.slice(0, rekeyIdx)) {
        for (const stmt of loadAndCleanSql(tag)) {
          try {
            await client.exec(stmt)
          } catch {
            /* skip statements that fail on a fresh database */
          }
        }
      }

      // Seed the pre-migration state: a Utilisateur whose credential row still
      // carries the sign-in e-mail as its account key, with a legacy bcrypt hash.
      const societeId = crypto.randomUUID()
      const departementId = crypto.randomUUID()
      const utilisateurId = crypto.randomUUID()
      const email = "legacy@acme.ma"
      const legacyHash = await bcryptHash("motdepasse-herite", BCRYPT_COST)
      await client.query(
        `INSERT INTO "societes" ("id", "nom", "modifieLe") VALUES ($1, $2, now())`,
        [societeId, "Acme"]
      )
      await client.query(
        `INSERT INTO "departements" ("id", "nom", "societeId") VALUES ($1, $2, $3)`,
        [departementId, "RH", societeId]
      )
      await client.query(
        `INSERT INTO "utilisateurs" ("id", "email", "emailVerified", "nom", "prenom", "poste", "role", "departementId", "societeId", "actif", "creeLe", "modifieLe")
         VALUES ($1, $2, true, $3, $4, $5, 'EMPLOYEE', $6, $7, true, now(), now())`,
        [utilisateurId, email, "Dupont", "Jean", "Développeur", departementId, societeId]
      )
      await client.query(
        `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $3, $4, now(), now())`,
        [crypto.randomUUID(), email, utilisateurId, legacyHash]
      )

      // Apply the new migration: re-key, then the unique identity index.
      for (const tag of tags.slice(rekeyIdx)) {
        for (const stmt of loadAndCleanSql(tag)) {
          await client.exec(stmt)
        }
      }

      const { rows } = await client.query<{ accountId: string }>(
        `SELECT "accountId" FROM "account" WHERE "userId" = $1 AND "providerId" = 'credential'`,
        [utilisateurId]
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].accountId).toBe(utilisateurId)

      const { rows: indexRows } = await client.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'account' AND indexname = 'account_providerId_accountId_unique'`
      )
      expect(indexRows).toHaveLength(1)

      // The migrated database still signs the Utilisateur in with the legacy hash.
      const migratedDb = drizzle(client, { schema })
      const migratedAuth = createAuth(migratedDb as unknown as DrizzleDb, {
        secret: TEST_SECRET,
      })
      const result = await migratedAuth.api.signInEmail({
        body: { email, password: "motdepasse-herite" },
        headers: new Headers({ origin: "http://localhost:3000" }),
      })
      expect(result.user.id).toBe(utilisateurId)
      expect(result.user.email).toBe(email)
    })
  })

  describe("attestation backfill (#204)", { timeout: TIMEOUT }, () => {
    it("marks every pre-existing Utilisateur row with the attestation", async () => {
      const client = await PGlite.create()
      const tags = migrationTags()
      const backfillTag = tags.find((tag) =>
        tag.includes("attestation_email_verified")
      )
      expect(backfillTag).toBe("0007_attestation_email_verified")
      const backfillIdx = tags.indexOf(backfillTag!)

      // Apply the migrations as they stood before the attestation backfill
      // (same apply semantics as the PGlite harness).
      for (const tag of tags.slice(0, backfillIdx)) {
        for (const stmt of loadAndCleanSql(tag)) {
          try {
            await client.exec(stmt)
          } catch {
            /* skip statements that fail on a fresh database */
          }
        }
      }

      // Seed the pre-migration state: rows written before the attestation was
      // part of provisioning carry emailVerified = false.  The inserts are raw
      // — nothing backfills at insert time, so the migration is the only
      // thing that can attest these rows.
      const societeId = crypto.randomUUID()
      const departementId = crypto.randomUUID()
      await client.query(
        `INSERT INTO "societes" ("id", "nom", "modifieLe") VALUES ($1, $2, now())`,
        [societeId, "Acme"]
      )
      await client.query(
        `INSERT INTO "departements" ("id", "nom", "societeId") VALUES ($1, $2, $3)`,
        [departementId, "RH", societeId]
      )
      const legacyEmails = ["legacy1@acme.ma", "legacy2@acme.ma"]
      for (const email of legacyEmails) {
        await client.query(
          `INSERT INTO "utilisateurs" ("id", "email", "emailVerified", "nom", "prenom", "poste", "role", "departementId", "societeId", "actif", "creeLe", "modifieLe")
           VALUES ($1, $2, false, $3, $4, $5, 'EMPLOYEE', $6, $7, true, now(), now())`,
          [
            crypto.randomUUID(),
            email,
            "Dupont",
            "Jean",
            "Développeur",
            departementId,
            societeId,
          ]
        )
      }

      const before = await client.query<{ atteste: boolean }>(
        `SELECT "emailVerified" AS atteste FROM "utilisateurs"`
      )
      expect(before.rows).toHaveLength(legacyEmails.length)
      expect(before.rows.every((row) => row.atteste === false)).toBe(true)

      // Apply the attestation backfill (and anything after it).
      for (const tag of tags.slice(backfillIdx)) {
        for (const stmt of loadAndCleanSql(tag)) {
          await client.exec(stmt)
        }
      }

      const { rows } = await client.query<{
        email: string
        emailVerified: boolean
      }>(`SELECT "email", "emailVerified" FROM "utilisateurs" ORDER BY "email"`)
      expect(rows).toHaveLength(legacyEmails.length)
      expect(rows.every((row) => row.emailVerified === true)).toBe(true)
      // The backfill flips the attestation only — identities are untouched.
      expect(rows.map((row) => row.email)).toEqual(legacyEmails)
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
        "societeId",
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

    it("wires the Google gate as user.validateUserInfo (no profile-map veto)", () => {
      expect(typeof auth.options.user.validateUserInfo).toBe("function")
      expect(Object.keys(auth.options.socialProviders.google)).not.toContain(
        "mapProfileToUser"
      )
    })

    it("registers nextCookies as the last plugin", () => {
      const plugins = auth.options.plugins ?? []
      expect(plugins.some((p) => p.id === "next-cookies")).toBe(true)
      expect(plugins.at(-1)?.id).toBe("next-cookies")
    })
  })

  describe("Google gate (AC3)", () => {
    // The gate is exercised through the public options contract — the same
    // entry point the engine calls — and the refusal payload is what a browser
    // ends up seeing as `?error=…&error_description=…`.
    function callGate(
      email: string | null,
      options: { providerId?: string | null; withOAuth?: boolean } = {}
    ) {
      const { providerId = "google", withOAuth = true } = options
      const validate = auth.options.user.validateUserInfo
      expect(typeof validate).toBe("function")
      return validate!({
        user: email === null ? {} : { email },
        source: {
          method: "oauth" as const,
          action: "create-user" as const,
          ...(withOAuth ? { oauth: { providerId: providerId! } } : {}),
        },
      }) as Promise<{ error: string; errorDescription?: string } | undefined>
    }

    it("refuses a Google sign-in for an unknown e-mail", async () => {
      const refusal = await callGate("inconnu@acme.ma")
      expect(refusal?.error).toBe(GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE)
      expect(refusal?.errorDescription).toBe(
        googleRefusalMessage(GOOGLE_REFUSAL_CODES.UTILISATEUR_INTROUVABLE)
      )
    })

    it("refuses a Google sign-in for a deactivated Utilisateur", async () => {
      await db
        .update(utilisateurs)
        .set({ actif: false })
        .where(eq(utilisateurs.id, utilisateurId))

      const refusal = await callGate(email)
      expect(refusal?.error).toBe(GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE)
      expect(refusal?.errorDescription).toBe(
        googleRefusalMessage(GOOGLE_REFUSAL_CODES.UTILISATEUR_DESACTIVE)
      )
    })

    it("refuses a Google sign-in for a Utilisateur without Google enabled", async () => {
      await db
        .update(utilisateurs)
        .set({ googleAuthEnabled: false })
        .where(eq(utilisateurs.id, utilisateurId))

      const refusal = await callGate(email)
      expect(refusal?.error).toBe(GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE)
      expect(refusal?.errorDescription).toBe(
        googleRefusalMessage(GOOGLE_REFUSAL_CODES.GOOGLE_NON_ACTIVE)
      )
    })

    it("gives every refusal a non-empty description", async () => {
      const unknown = await callGate("inconnu@acme.ma")

      await db
        .update(utilisateurs)
        .set({ actif: false })
        .where(eq(utilisateurs.id, utilisateurId))
      const deactivated = await callGate(email)

      await db
        .update(utilisateurs)
        .set({ actif: true, googleAuthEnabled: false })
        .where(eq(utilisateurs.id, utilisateurId))
      const notEnabled = await callGate(email)

      for (const refusal of [unknown, deactivated, notEnabled]) {
        expect(typeof refusal?.error).toBe("string")
        expect(refusal!.errorDescription!.length).toBeGreaterThan(0)
      }
    })

    it("allows an active, Google-enabled Utilisateur", async () => {
      await expect(callGate(email)).resolves.toBeUndefined()
    })

    it("allows non-Google sources without consulting the utilisateurs", async () => {
      await expect(
        callGate("inconnu@acme.ma", { providerId: "github" })
      ).resolves.toBeUndefined()
      await expect(
        callGate("inconnu@acme.ma", { withOAuth: false })
      ).resolves.toBeUndefined()
    })

    it("matches the stored e-mail case-insensitively", async () => {
      await db
        .update(utilisateurs)
        .set({ email: "Jean.Dupont@Acme.ma" })
        .where(eq(utilisateurs.id, utilisateurId))

      await expect(callGate("jean.dupont@acme.ma")).resolves.toBeUndefined()
      await expect(callGate("JEAN.DUPONT@ACME.MA")).resolves.toBeUndefined()
    })
  })

  describe("setPassword (AC4)", () => {
    it("creates the credential row keyed on the Utilisateur id", async () => {
      await setPassword(db as unknown as DrizzleDb, utilisateurId, "motdepasse-123")

      const rows = await db
        .select()
        .from(account)
        .where(eq(account.userId, utilisateurId))
      expect(rows).toHaveLength(1)
      expect(rows[0].providerId).toBe(CREDENTIAL_PROVIDER_ID)
      expect(rows[0].accountId).toBe(utilisateurId)
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

    it("re-keys a legacy e-mail-keyed row on the upsert path", async () => {
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: email,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId: utilisateurId,
        password: "$legacy$",
        updatedAt: new Date(),
      })

      await setPassword(db as unknown as DrizzleDb, utilisateurId, "motdepasse-123")

      const rows = await db
        .select()
        .from(account)
        .where(eq(account.userId, utilisateurId))
      expect(rows).toHaveLength(1)
      expect(rows[0].accountId).toBe(utilisateurId)
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
        accountId: utilisateurId,
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
