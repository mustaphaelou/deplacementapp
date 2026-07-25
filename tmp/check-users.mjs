import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://user:pass@localhost:5433/deplacementapp" } },
})
const users = await prisma.utilisateur.findMany({ take: 5 })
console.log(JSON.stringify(users, null, 2))
await prisma.$disconnect()