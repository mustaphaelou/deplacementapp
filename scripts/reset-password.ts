import { existsSync } from "node:fs"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { utilisateurs } from "../db/schema/utilisateurs"
import { setPassword } from "../lib/auth/set-password"

if (existsSync(".env")) process.loadEnvFile(".env")

async function main() {
  const [email, password] = process.argv.slice(2)
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/reset-password.ts <email> <new-password>")
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

  await setPassword(db, utilisateur.id, password)
  console.log(`Password reset for ${utilisateur.prenom} ${utilisateur.nom} <${email}>`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
