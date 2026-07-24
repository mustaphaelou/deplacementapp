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

  const societe = await prisma.societe.upsert({
    where: { id: "default" },
    update: { nom: "Ma Société" },
    create: { nom: "Ma Société" },
  })

  const deptDG = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Direction Générale", societeId: societe.id } },
    update: {},
    create: { nom: "Direction Générale", societeId: societe.id },
  })

  const deptFin = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Administration et Finances", societeId: societe.id } },
    update: {},
    create: { nom: "Administration et Finances", societeId: societe.id },
  })

  const deptCom = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Commercial", societeId: societe.id } },
    update: {},
    create: { nom: "Commercial", societeId: societe.id },
  })

  const deptTech = await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Technique", societeId: societe.id } },
    update: {},
    create: { nom: "Technique", societeId: societe.id },
  })

  await prisma.departement.upsert({
    where: { nom_societeId: { nom: "Production", societeId: societe.id } },
    update: {},
    create: { nom: "Production", societeId: societe.id },
  })

  const users = [
    { email: "directeur@exemple.ma", nom: "Directeur", prenom: "Ahmed", poste: "Directeur Général", role: "GENERAL_DIRECTION" as Role, departementId: deptDG.id },
    { email: "finance@exemple.ma", nom: "Comptable", prenom: "Fatima", poste: "Responsable Financier", role: "FINANCE_ADMIN" as Role, departementId: deptFin.id },
    { email: "manager@exemple.ma", nom: "Chef", prenom: "Hassan", poste: "Chef de projet", role: "MANAGER" as Role, departementId: deptTech.id },
    { email: "employe@exemple.ma", nom: "Employe", prenom: "Youssef", poste: "Conducteur", role: "EMPLOYEE" as Role, departementId: deptTech.id },
    { email: "commercial@exemple.ma", nom: "Commercial", prenom: "Karim", poste: "Commercial", role: "EMPLOYEE" as Role, departementId: deptCom.id },
  ]

  for (const user of users) {
    await prisma.utilisateur.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, motDePasse: hashedPassword, societeId: societe.id },
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