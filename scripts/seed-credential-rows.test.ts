import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { eq, sql } from "drizzle-orm"
import { hash as bcryptHash } from "bcryptjs"
import { createPgliteDb } from "../lib/test/create-pglite-db"
import type { PgliteDb } from "../lib/test/create-pglite-db"
import * as schema from "../db/schema"
import { account } from "../db/schema/auth-tables"
import { utilisateurs } from "../db/schema/utilisateurs"
import { seedCredentialRows } from "./seed-credential-rows"
import { createAuth, BCRYPT_COST } from "../lib/auth/better-auth"
import { CREDENTIAL_PROVIDER_ID } from "../lib/auth/set-password"
import type { DrizzleDb } from "../db"

const TIMEOUT = 30_000
const TEST_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz"

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
    googleAuthEnabled: false,
    creeLe: new Date("2026-01-01"),
    modifieLe: new Date("2026-01-01"),
    ...overrides,
  }
}

describe("seed credential rows (T3 #166)", { timeout: TIMEOUT }, () => {
  let db: PgliteDb
  let auth: TestAuth

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

    await db.insert(schema.utilisateurs).values([
      makeUtilisateur({
        email: "employe@acme.ma",
        motDePasse: await bcryptHash("employe-password", BCRYPT_COST),
        departementId,
        societeId,
      }),
      makeUtilisateur({
        email: "manager@acme.ma",
        motDePasse: await bcryptHash("manager-password", BCRYPT_COST),
        departementId,
        societeId,
      }),
      makeUtilisateur({
        email: "google-uniquement@acme.ma",
        motDePasse: null,
        googleAuthEnabled: true,
        departementId,
        societeId,
      }),
    ])
  })

  async function credentialRows(): Promise<
    { userId: string; accountId: string; providerId: string; password: string | null }[]
  > {
    return db
      .select({
        userId: account.userId,
        accountId: account.accountId,
        providerId: account.providerId,
        password: account.password,
      })
      .from(account)
  }

  describe("seeding (AC1 + AC2)", () => {
    it("creates one credential row per Utilisateur with a password, copying the hash as-is", async () => {
      const result = await seedCredentialRows(db as unknown as DrizzleDb)
      expect(result.seeded).toBe(2)

      const rows = await credentialRows()
      expect(rows).toHaveLength(2)

      const [employe, manager] = await db
        .select({ email: utilisateurs.email, motDePasse: utilisateurs.motDePasse })
        .from(utilisateurs)
        .where(sql`${utilisateurs.email} IN (${"employe@acme.ma"}, ${"manager@acme.ma"})`)
        .orderBy(utilisateurs.email)

      const pairs: [typeof rows[number], typeof employe][] = [
        [rows.find((r) => r.accountId === "employe@acme.ma")!, employe!],
        [rows.find((r) => r.accountId === "manager@acme.ma")!, manager!],
      ]
      for (const [row, user] of pairs) {
        expect(row.password).toBe(user.motDePasse)
        expect(row.password).toMatch(/^\$2/)
      }
    })

    it("skips Utilisateurs without a stored password", async () => {
      const result = await seedCredentialRows(db as unknown as DrizzleDb)
      expect(result.skippedWithoutPassword).toBe(1)

      const googleRows = await db
        .select({ accountId: account.accountId })
        .from(account)
        .where(eq(account.accountId, "google-uniquement@acme.ma"))
      expect(googleRows).toHaveLength(0)
    })

    it("carries providerId 'credential' and the Utilisateur email as identifier", async () => {
      await seedCredentialRows(db as unknown as DrizzleDb)

      const rows = await credentialRows()
      const emails = await db
        .select({ email: utilisateurs.email })
        .from(utilisateurs)
        .where(sql`${utilisateurs.motDePasse} IS NOT NULL`)
      const byAccountId = new Map(rows.map((row) => [row.accountId, row]))
      for (const { email } of emails) {
        const row = byAccountId.get(email)
        expect(row).toBeDefined()
        expect(row!.providerId).toBe(CREDENTIAL_PROVIDER_ID)
      }
      expect(byAccountId.size).toBe(2)
    })

    it("leaves the legacy motDePasse column untouched (safe to run pre-cutover)", async () => {
      const before = await db
        .select({ id: utilisateurs.id, motDePasse: utilisateurs.motDePasse })
        .from(utilisateurs)
        .orderBy(utilisateurs.email)

      await seedCredentialRows(db as unknown as DrizzleDb)

      const after = await db
        .select({ id: utilisateurs.id, motDePasse: utilisateurs.motDePasse })
        .from(utilisateurs)
        .orderBy(utilisateurs.email)
      expect(after).toEqual(before)
    })
  })

  describe("idempotency (AC1)", () => {
    it("re-running does not duplicate rows", async () => {
      const first = await seedCredentialRows(db as unknown as DrizzleDb)
      const second = await seedCredentialRows(db as unknown as DrizzleDb)

      expect(first.seeded).toBe(2)
      expect(second.seeded).toBe(0)
      expect(second.skippedAlreadyPresent).toBe(2)
      expect(await credentialRows()).toHaveLength(2)
    })

    it("refreshes the copied hash when the legacy hash changed between runs", async () => {
      await seedCredentialRows(db as unknown as DrizzleDb)

      const newHash = await bcryptHash("nouveau-motdepasse", BCRYPT_COST)
      await db
        .update(utilisateurs)
        .set({ motDePasse: newHash })
        .where(eq(utilisateurs.email, "employe@acme.ma"))

      const second = await seedCredentialRows(db as unknown as DrizzleDb)
      expect(second.seeded).toBe(0)
      expect(second.refreshed).toBe(1)

      const [employe] = await db
        .select({ password: account.password })
        .from(account)
        .where(eq(account.accountId, "employe@acme.ma"))
        .limit(1)
      expect(employe!.password).toBe(newHash)
      expect(await credentialRows()).toHaveLength(2)
    })

    it("fills gaps for Utilisateurs provisioned after the first run", async () => {
      await seedCredentialRows(db as unknown as DrizzleDb)

      const [societe] = await db
        .select({ societeId: schema.societes.id, departementId: schema.departements.id })
        .from(schema.societes)
        .innerJoin(schema.departements, eq(schema.departements.societeId, schema.societes.id))
        .limit(1)
      await db.insert(schema.utilisateurs).values(
        makeUtilisateur({
          email: "nouveau@acme.ma",
          motDePasse: await bcryptHash("nouveau-password", BCRYPT_COST),
          societeId: societe!.societeId,
          departementId: societe!.departementId,
        })
      )

      const second = await seedCredentialRows(db as unknown as DrizzleDb)
      expect(second.seeded).toBe(1)
      expect(second.skippedAlreadyPresent).toBe(2)
      expect(await credentialRows()).toHaveLength(3)
    })
  })

  describe("smoke: seeded Utilisateurs sign in with their existing password (AC3)", () => {
    it("signs in a sample of seeded Utilisateurs against the T1 adapter", async () => {
      await seedCredentialRows(db as unknown as DrizzleDb)

      for (const [email, password] of [
        ["employe@acme.ma", "employe-password"],
        ["manager@acme.ma", "manager-password"],
      ] as const) {
        const result = await auth.api.signInEmail({
          body: { email, password },
          headers: new Headers({ origin: "http://localhost:3000" }),
        })
        expect(result.user.email).toBe(email)

        const sessions = await db.query.session.findMany()
        expect(sessions.some((s) => s.userId === result.user.id)).toBe(true)
        await db.execute(sql`DELETE FROM session`)
      }
    })

    it("rejects a wrong password for a seeded Utilisateur", async () => {
      await seedCredentialRows(db as unknown as DrizzleDb)

      await expect(
        auth.api.signInEmail({
          body: { email: "employe@acme.ma", password: "mauvais-password" },
          headers: new Headers({ origin: "http://localhost:3000" }),
        })
      ).rejects.toMatchObject({ statusCode: 401 })
      expect(await db.query.session.findMany()).toHaveLength(0)
    })
  })
})
