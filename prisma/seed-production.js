import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pkg from "pg"
const { Pool } = pkg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("==> Seeding departments...")
  const depts = [
    "Direction Générale",
    "Administration et Finances",
    "Commercial",
    "Technique",
    "Production"
  ]

  for (const dept of depts) {
    await prisma.departement.upsert({
      where: { nom: dept },
      update: {},
      create: { nom: dept },
    })
  }

  console.log("==> Seeding company vehicles...")
  const vehicles = [
    { nom: "Toyota Hilux", immatriculation: "1234-A-5" },
    { nom: "Renault Kangoo", immatriculation: "5678-B-9" },
    { nom: "Peugeot Partner", immatriculation: "1011-C-2" },
    { nom: "Dacia Logan", immatriculation: "3141-D-5" },
    { nom: "Ford Transit", immatriculation: "6171-E-8" },
  ]

  for (const v of vehicles) {
    await prisma.vehiculeEntreprise.upsert({
      where: { immatriculation: v.immatriculation },
      update: {},
      create: v,
    })
  }

  console.log("Production seed data created successfully")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
