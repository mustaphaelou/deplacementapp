import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pkg from "pg"
import { hash } from "bcryptjs"
const { Pool } = pkg

const args = process.argv.slice(2)
const getArg = (name) => {
  const index = args.indexOf(name)
  return index !== -1 && args[index + 1] ? args[index + 1] : null
}

const email = getArg("--email")
const nom = getArg("--nom")
const prenom = getArg("--prenom")
const role = getArg("--role") // e.g. GENERAL_DIRECTION
const password = getArg("--password")

if (!email || !nom || !prenom || !role || !password) {
  console.error("Missing required arguments.")
  console.error("Usage: node prisma/create-admin.js --email <email> --nom <nom> --prenom <prenom> --role <role> --password <password>")
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Ensure the department for Direction Générale exists
  const dept = await prisma.departement.upsert({
    where: { nom: "Direction Générale" },
    update: {},
    create: { nom: "Direction Générale" }
  })

  const hashedPassword = await hash(password, 12)

  console.log(`==> Creating admin user: ${email}...`)
  const user = await prisma.utilisateur.upsert({
    where: { email },
    update: {
      nom,
      prenom,
      role,
      motDePasse: hashedPassword,
      departementId: dept.id
    },
    create: {
      email,
      nom,
      prenom,
      role,
      motDePasse: hashedPassword,
      departementId: dept.id,
      poste: "Direction Générale"
    }
  })

  console.log(`Admin user created/updated successfully with ID: ${user.id}`)
}

main()
  .catch((e) => {
    console.error("Error creating admin:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
