import { existsSync } from "node:fs"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { utilisateurs } from "../db/schema/utilisateurs"
import { generateTemporaryPassword, setPassword } from "../lib/auth/set-password"

if (existsSync(".env")) process.loadEnvFile(".env")

// #238 — the operator floor of the provisioning default: an omitted password
// provisions a random one-time credential (never a constant) and flags the
// account for forced rotation; a supplied password must clear the 12-char
// floor.  A generated credential is printed once so the operator can deliver
// it out of band.
const MIN_OPERATOR_PASSWORD_LENGTH = 12

async function main() {
  const [email, password] = process.argv.slice(2)
  if (!email) {
    console.error(
      "Usage: npx tsx scripts/reset-password.ts <email> [new-password]"
    )
    process.exit(1)
  }

  const temporaryPassword = password ? null : generateTemporaryPassword()
  const nextPassword = password ?? temporaryPassword!
  if (nextPassword.length < MIN_OPERATOR_PASSWORD_LENGTH) {
    console.error(
      `Refusing: password must contain at least ${MIN_OPERATOR_PASSWORD_LENGTH} characters`
    )
    process.exit(1)
  }

  const [utilisateur] = await db
    .select({ id: utilisateurs.id, nom: utilisateurs.nom, prenom: utilisateurs.prenom })
    .from(utilisateurs)
    .where(eq(utilisateurs.email, email))
    .limit(1)

  if (!utilisateur) {
    console.error(`No utilisateur found for "${email}"`)
    process.exit(1)
  }

  await db.transaction(async (tx) => {
    await setPassword(tx, utilisateur.id, nextPassword)
    // An operator-set credential is known to someone other than the holder:
    // force rotation at next sign-in.
    await tx
      .update(utilisateurs)
      .set({ doitChangerMotDePasse: true })
      .where(eq(utilisateurs.id, utilisateur.id))
  })
  if (temporaryPassword) {
    console.log(
      `Temporary password for ${utilisateur.prenom} ${utilisateur.nom} <${email}> (deliver out of band, rotation required): ${temporaryPassword}`
    )
  } else {
    console.log(`Password reset for ${utilisateur.prenom} ${utilisateur.nom} <${email}> (rotation required)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
