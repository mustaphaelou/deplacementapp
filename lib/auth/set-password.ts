import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs"
import { and, eq } from "drizzle-orm"
import type { DrizzleDb, DrizzleTransactionClient } from "../../db"
import { account } from "../../db/schema/auth-tables"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { UtilisateurNotFoundError } from "../errors"
import { BCRYPT_COST } from "./better-auth"

export const CREDENTIAL_PROVIDER_ID = "credential"

type CredentialDb = DrizzleDb | DrizzleTransactionClient

function credentialWhere(utilisateurId: string) {
  return and(
    eq(account.userId, utilisateurId),
    eq(account.providerId, CREDENTIAL_PROVIDER_ID)
  )
}

/**
 * The single accessor of the credential (`account`, `providerId: "credential"`)
 * row for a Utilisateur: `setPassword` writes, `verifyCredential` reads, and
 * `syncCredentialIdentifier` keeps the row's identifier aligned with the
 * Utilisateur's current email.
 */

/**
 * Upsert the credential row for a Utilisateur, pinning its `accountId` to the
 * Utilisateur's *current* email, so an email change is picked up on the next
 * write.  The plaintext is hashed with bcryptjs at cost 12, the same cost as
 * the legacy `motDePasse` hashes.
 */
export async function setPassword(
  db: CredentialDb,
  utilisateurId: string,
  plaintext: string
): Promise<void> {
  const [utilisateur] = await db
    .select({ email: utilisateurs.email })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, utilisateurId))
    .limit(1)
  if (!utilisateur) {
    throw new UtilisateurNotFoundError()
  }

  const password = await bcryptHash(plaintext, BCRYPT_COST)
  const now = new Date()

  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(credentialWhere(utilisateurId))
    .limit(1)

  if (existing) {
    await db
      .update(account)
      .set({ accountId: utilisateur.email, password, updatedAt: now })
      .where(eq(account.id, existing.id))
    return
  }

  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId: utilisateurId,
    accountId: utilisateur.email,
    providerId: CREDENTIAL_PROVIDER_ID,
    password,
    createdAt: now,
    updatedAt: now,
  })
}

/**
 * Verify a plaintext password against the Utilisateur's credential row.
 * Returns false for a Utilisateur without a credential row.
 */
export async function verifyCredential(
  db: CredentialDb,
  utilisateurId: string,
  plaintext: string
): Promise<boolean> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(credentialWhere(utilisateurId))
    .limit(1)
  if (!row?.password) return false
  return bcryptCompare(plaintext, row.password)
}

/**
 * Point the credential row's identifier at the Utilisateur's current email.
 * No-op when the Utilisateur has no credential row yet.
 */
export async function syncCredentialIdentifier(
  db: CredentialDb,
  utilisateurId: string
): Promise<void> {
  const [utilisateur] = await db
    .select({ email: utilisateurs.email })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, utilisateurId))
    .limit(1)
  if (!utilisateur) {
    throw new UtilisateurNotFoundError()
  }

  await db
    .update(account)
    .set({ accountId: utilisateur.email, updatedAt: new Date() })
    .where(credentialWhere(utilisateurId))
}
