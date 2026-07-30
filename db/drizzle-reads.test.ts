import { describe, it, expect } from "vitest"
import { sql } from "drizzle-orm"
import { db } from "./index"

async function isDbAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

const dbAvailable = await isDbAvailable()

describe.skipIf(!dbAvailable)("Drizzle reads", () => {
  it("reads societes", async () => {
    const rows = await db.query.societes.findMany({
      orderBy: (s, { asc }) => [asc(s.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads departements", async () => {
    const rows = await db.query.departements.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads utilisateurs", async () => {
    const rows = await db.query.utilisateurs.findMany({
      orderBy: (u, { asc }) => [asc(u.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads vehicules_entreprise", async () => {
    const rows = await db.query.vehiculesEntreprise.findMany({
      orderBy: (v, { asc }) => [asc(v.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads demandes_deplacement", async () => {
    const rows = await db.query.demandesDeplacement.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads notifications", async () => {
    const rows = await db.query.notifications.findMany({
      orderBy: (n, { asc }) => [asc(n.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads journal_audit", async () => {
    const rows = await db.query.journalAudit.findMany({
      orderBy: (j, { asc }) => [asc(j.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it("reads documents", async () => {
    const rows = await db.query.documents.findMany({
      orderBy: (d, { asc }) => [asc(d.id)],
    })
    expect(Array.isArray(rows)).toBe(true)
  })
})
