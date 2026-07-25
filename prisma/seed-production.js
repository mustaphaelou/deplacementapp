import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hash } from "bcryptjs"
import pkg from "pg"
const { Pool } = pkg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await hash("password123", 12)

  console.log("==> Ensuring default société...")
  await prisma.societe.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", nom: "Ma Société", modifieLe: new Date() },
  })

  console.log("==> Seeding departments...")
  const deptDG = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Direction Générale", societeId: "default" } },
    update: {},
    create: { nom: "Direction Générale", societeId: "default" },
  })

  const deptFin = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Administration et Finances", societeId: "default" } },
    update: {},
    create: { nom: "Administration et Finances", societeId: "default" },
  })

  const deptCom = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Commercial", societeId: "default" } },
    update: {},
    create: { nom: "Commercial", societeId: "default" },
  })

  const deptTech = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Technique", societeId: "default" } },
    update: {},
    create: { nom: "Technique", societeId: "default" },
  })

  await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Production", societeId: "default" } },
    update: {},
    create: { nom: "Production", societeId: "default" },
  })

  console.log("==> Seeding users...")
  const users = [
    { email: "directeur@exemple.ma", nom: "Directeur", prenom: "Ahmed", poste: "Directeur Général", role: "GENERAL_DIRECTION", departementId: deptDG.id },
    { email: "finance@exemple.ma", nom: "Comptable", prenom: "Fatima", poste: "Responsable Financier", role: "FINANCE_ADMIN", departementId: deptFin.id },
    { email: "manager@exemple.ma", nom: "Chef", prenom: "Hassan", poste: "Chef de projet", role: "MANAGER", departementId: deptTech.id },
    { email: "employe@exemple.ma", nom: "Employe", prenom: "Youssef", poste: "Conducteur", role: "EMPLOYEE", departementId: deptTech.id },
    { email: "commercial@exemple.ma", nom: "Commercial", prenom: "Karim", poste: "Commercial", role: "EMPLOYEE", departementId: deptCom.id },
  ]

  for (const user of users) {
    await prisma.utilisateur.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, motDePasse: hashedPassword, societeId: "default" },
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
