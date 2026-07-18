import "dotenv/config"
import { PrismaClient, Role } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { hash } from "bcryptjs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const hashedPassword = await hash("password123", 12)

  const deptDG = await prisma.departement.upsert({
    where: { nom: "Direction Générale" },
    update: {},
    create: { nom: "Direction Générale" },
  })

  const deptFin = await prisma.departement.upsert({
    where: { nom: "Administration et Finances" },
    update: {},
    create: { nom: "Administration et Finances" },
  })

  const deptCom = await prisma.departement.upsert({
    where: { nom: "Commercial" },
    update: {},
    create: { nom: "Commercial" },
  })

  const deptTech = await prisma.departement.upsert({
    where: { nom: "Technique" },
    update: {},
    create: { nom: "Technique" },
  })

  const deptProd = await prisma.departement.upsert({
    where: { nom: "Production" },
    update: {},
    create: { nom: "Production" },
  })

  const users = [
    { email: "directeur@hay2010.ma", nom: "Directeur", prenom: "Ahmed", poste: "Directeur Général", role: "GENERAL_DIRECTION" as Role, departementId: deptDG.id },
    { email: "finance@hay2010.ma", nom: "Comptable", prenom: "Fatima", poste: "Responsable Financier", role: "FINANCE_ADMIN" as Role, departementId: deptFin.id },
    { email: "manager@hay2010.ma", nom: "Chef", prenom: "Hassan", poste: "Chef de projet", role: "MANAGER" as Role, departementId: deptTech.id },
    { email: "employe@hay2010.ma", nom: "Employe", prenom: "Youssef", poste: "Conducteur", role: "EMPLOYEE" as Role, departementId: deptTech.id },
    { email: "commercial@hay2010.ma", nom: "Commercial", prenom: "Karim", poste: "Commercial", role: "EMPLOYEE" as Role, departementId: deptCom.id },
  ]

  for (const user of users) {
    await prisma.utilisateur.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, motDePasse: hashedPassword },
    })
  }

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

  console.log("Seed data created successfully")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
