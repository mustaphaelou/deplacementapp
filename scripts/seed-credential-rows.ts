import { and, eq } from "drizzle-orm"
import { pathToFileURL } from "url"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { account } from "../db/schema/auth-tables"
import { utilisateurs } from "../db/schema/utilisateurs"
import { CREDENTIAL_PROVIDER_ID } from "../lib/auth/set-password"

/**
 * One-off data migration (ADR 0016 step 9): seed a credential row
 * (`account`, `providerId: "credential"`) per Utilisateur that has a legacy
 * password hash in `utilisateurs.motDePasse`.
 *
 * The hash is copied as-is (no re-hash, no reset) so the bcryptjs verify
 * configured on the Better Auth adapter accepts it unchanged.  The row's
 * identifier is pinned to the Utilisateur's email.
 *
 * Idempotent: re-running never duplicates.  A Utilisateur that already has a
 * credential row is skipped, except when its copied hash differs from the
 * current `motDePasse` (e.g. a password changed between two runs) — the row
 * is then refreshed with the current hash.  Utilisateurs without a stored
 * password (Google-only) are skipped.
 *
 * Safe to run while the app is still on next-auth: the script only reads
 * `utilisateurs.motDePasse` and writes `account` rows, leaving the legacy
 * column untouched, and the rows are inert until the Better Auth endpoints
 * take over.
 *
 * Usage:
 *   npm run seed:credential-rows
 */

export interface SeedCredentialRowsResult {
  seeded: number
  refreshed: number
  skippedAlreadyPresent: number
  skippedWithoutPassword: number
}

/**
 * Seed the credential rows for the given database.  Returns how many rows
 * were created, how many stale copies were refreshed, and how many
 * Utilisateurs were skipped and why.
 */
export async function seedCredentialRows(
  db: DrizzleDb
): Promise<SeedCredentialRowsResult> {
  const users = await db
    .select({
      id: utilisateurs.id,
      email: utilisateurs.email,
      motDePasse: utilisateurs.motDePasse,
    })
    .from(utilisateurs)

  const existingRows = await db
    .select({ userId: account.userId, password: account.password })
    .from(account)
    .where(eq(account.providerId, CREDENTIAL_PROVIDER_ID))
  const existingByUser = new Map(
    existingRows.map((row) => [row.userId, row.password])
  )

  const toSeed: {
    userId: string
    accountId: string
    password: string
  }[] = []
  let refreshed = 0
  let skippedAlreadyPresent = 0
  let skippedWithoutPassword = 0

  for (const user of users) {
    if (!user.motDePasse) {
      skippedWithoutPassword += 1
      continue
    }
    const existingPassword = existingByUser.get(user.id)
    if (existingPassword === undefined) {
      toSeed.push({
        userId: user.id,
        accountId: user.email,
        password: user.motDePasse,
      })
      continue
    }
    if (existingPassword === user.motDePasse) {
      skippedAlreadyPresent += 1
      continue
    }
    refreshed += 1
    await db
      .update(account)
      .set({ password: user.motDePasse, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, user.id),
          eq(account.providerId, CREDENTIAL_PROVIDER_ID)
        )
      )
  }

  if (toSeed.length > 0) {
    const now = new Date()
    await db.insert(account).values(
      toSeed.map((row) => ({
        id: crypto.randomUUID(),
        userId: row.userId,
        accountId: row.accountId,
        providerId: CREDENTIAL_PROVIDER_ID,
        password: row.password,
        createdAt: now,
        updatedAt: now,
      }))
    )
  }

  return {
    seeded: toSeed.length,
    refreshed,
    skippedAlreadyPresent,
    skippedWithoutPassword,
  }
}

async function main(): Promise<void> {
  const result = await seedCredentialRows(db)
  console.log(
    `[seed-credential-rows] seeded=${result.seeded} ` +
      `refreshed=${result.refreshed} ` +
      `already-present=${result.skippedAlreadyPresent} ` +
      `without-password=${result.skippedWithoutPassword}`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
