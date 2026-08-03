import { hash as bcryptHash } from "bcryptjs"
import { and, eq } from "drizzle-orm"
import type { DrizzleDb } from "../../db"
import { account } from "../../db/schema/auth-tables"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { BCRYPT_COST } from "./better-auth"

export const CREDENTIAL_PROVIDER_ID = "credential"

export class UtilisateurIntrouvableError extends Error {
  constructor() {
    super("Utilisateur introuvable")
    this.name = "UtilisateurIntrouvableError"
  }
}

/**
 * The single writer of credential rows for a Utilisateur.
 *
 * Upserts the `account` row with `providerId: "credential"` and pins its
 * `accountId` to the Utilisateur's *current* email, so an email change is
 * picked up on the next write.  The plaintext is hashed with bcryptjs at cost
 * 12, the same cost as the legacy `motDePasse` hashes.
 */
export async function setPassword(
  db: DrizzleDb,
  utilisateurId: string,
  plaintext: string
): Promise<void> {
  const [utilisateur] = await db
    .select({ email: utilisateurs.email })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, utilisateurId))
    .limit(1)
  if (!utilisateur) {
    throw new UtilisateurIntrouvableError()
  }

  const password = await bcryptHash(plaintext, BCRYPT_COST)
  const now = new Date()

  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, utilisateurId),
        eq(account.providerId, CREDENTIAL_PROVIDER_ID)
      )
    )
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
