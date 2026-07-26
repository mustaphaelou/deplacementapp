import { describe, it, expect } from "vitest"
import { sql } from "drizzle-orm"
import { prisma } from "../lib/prisma"
import { db } from "./index"

async function isDbAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

const dbAvailable = await isDbAvailable()

describe.skipIf(!dbAvailable)("Drizzle reads match Prisma reads", () => {
  it("reads societes identically", async () => {
    const prismaRows = await prisma.societe.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.societes.findMany({ orderBy: (s, { asc }) => [asc(s.id)] })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
      expect(drizzleRows[i].nom).toBe(prismaRows[i].nom)
    }
  })

  it("reads departements identically", async () => {
    const prismaRows = await prisma.departement.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.departements.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
    }
  })

  it("reads utilisateurs identically", async () => {
    const prismaRows = await prisma.utilisateur.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.utilisateurs.findMany({
      orderBy: (u, { asc }) => [asc(u.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
      expect(drizzleRows[i].email).toBe(prismaRows[i].email)
    }
  })

  it("reads vehicules_entreprise identically", async () => {
    const prismaRows = await prisma.vehiculeEntreprise.findMany({
      orderBy: { id: "asc" },
    })
    const drizzleRows = await db.query.vehiculesEntreprise.findMany({
      orderBy: (v, { asc }) => [asc(v.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
    }
  })

  it("reads demandes_deplacement identically", async () => {
    const prismaRows = await prisma.demandeDeplacement.findMany({
      orderBy: { id: "asc" },
    })
    const drizzleRows = await db.query.demandesDeplacement.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
      expect(drizzleRows[i].numero).toBe(prismaRows[i].numero)
      expect(drizzleRows[i].statut).toBe(prismaRows[i].statut)
    }
  })

  it("reads notifications identically", async () => {
    const prismaRows = await prisma.notification.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.notifications.findMany({
      orderBy: (n, { asc }) => [asc(n.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
    }
  })

  it("reads journal_audit identically", async () => {
    const prismaRows = await prisma.journalAudit.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.journalAudit.findMany({
      orderBy: (j, { asc }) => [asc(j.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
    }
  })

  it("reads documents identically", async () => {
    const prismaRows = await prisma.document.findMany({ orderBy: { id: "asc" } })
    const drizzleRows = await db.query.documents.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(drizzleRows.length).toBe(prismaRows.length)
    for (let i = 0; i < prismaRows.length; i++) {
      expect(drizzleRows[i].id).toBe(prismaRows[i].id)
    }
  })
})
