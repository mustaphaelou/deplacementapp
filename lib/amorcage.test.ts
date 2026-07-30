import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../db/schema"
import * as dbModule from "../db"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import { estEnAmorcage, quitterAmorcage } from "./amorcage"
import { AmorcageDejaConfigureError } from "./errors"
import { loadSocieteIdentity, clearSocieteCache } from "@/lib/societe"

const TIMEOUT = 30_000

describe("Amorcage module", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
    vi.spyOn(dbModule, "db", "get").mockReturnValue(pgliteDb as any)
  })

  beforeEach(async () => {
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)
    clearSocieteCache()
  })

  it("estEnAmorcage returns true when no Societe exists", async () => {
    expect(await estEnAmorcage()).toBe(true)
  })

  it("estEnAmorcage returns false after a Societe is inserted", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "s1",
      nom: "Test Inc",
      nomExpediteurEmail: "Test",
      domaineEmail: "test.ma",
      modifieLe: new Date(),
    })

    expect(await estEnAmorcage()).toBe(false)
  })

  it("quitterAmorcage on valid payload inserts Societe, Departements, and admin Utilisateur", async () => {
    const result = await quitterAmorcage({
      societe: {
        nom: "Ma Societe",
        nomExpediteurEmail: "Ma Societe",
        domaineEmail: "ma-societe.ma",
      },
      departements: ["RH", "Finance", "Technique"],
      admin: {
        email: "admin@ma-societe.ma",
        password: "securePassword123",
        nom: "Dupont",
        prenom: "Jean",
        poste: "Administrateur",
        departementNom: "Technique",
      },
    })

    expect(result.user).toMatchObject({
      email: "admin@ma-societe.ma",
      prenom: "Jean",
      nom: "Dupont",
      role: "GENERAL_DIRECTION",
    })
    expect(result.user.id).toBeDefined()

    const [societeRow] = await pgliteDb
      .select()
      .from(schema.societes)
      .limit(1)
    expect(societeRow).toMatchObject({
      nom: "Ma Societe",
      nomExpediteurEmail: "Ma Societe",
      domaineEmail: "ma-societe.ma",
    })

    const deptRows = await pgliteDb.select().from(schema.departements)
    expect(deptRows).toHaveLength(3)
    const deptNoms = deptRows.map((d) => d.nom).sort()
    expect(deptNoms).toEqual(["Finance", "RH", "Technique"])

    const [userRow] = await pgliteDb
      .select()
      .from(schema.utilisateurs)
      .limit(1)
    expect(userRow).toMatchObject({
      email: "admin@ma-societe.ma",
      nom: "Dupont",
      prenom: "Jean",
      poste: "Administrateur",
      role: "GENERAL_DIRECTION",
      actif: true,
    })
    expect(userRow.motDePasse).toBeDefined()
    expect(userRow.motDePasse).not.toBe("securePassword123")

    const { compare } = await import("bcryptjs")
    const isMatch = await compare("securePassword123", userRow.motDePasse!)
    expect(isMatch).toBe(true)
  })

  it("quitterAmorcage throws AmorcageDejaConfigureError when a Societe already exists", async () => {
    await pgliteDb.insert(schema.societes).values({
      id: "existing",
      nom: "Existing Inc",
      nomExpediteurEmail: "Existing",
      domaineEmail: "existing.ma",
      modifieLe: new Date(),
    })

    await expect(
      quitterAmorcage({
        societe: {
          nom: "New Inc",
          nomExpediteurEmail: "New",
          domaineEmail: "new.ma",
        },
        departements: ["RH"],
        admin: {
          email: "admin@new.ma",
          password: "password123",
          nom: "Test",
          prenom: "User",
          poste: "Admin",
          departementNom: "RH",
        },
      }),
    ).rejects.toThrow(AmorcageDejaConfigureError)
  })

  it("mid-tx failure rolls back all inserts — no orphan Societe", async () => {
    await expect(
      quitterAmorcage({
        societe: {
          nom: "Rollback Inc",
          nomExpediteurEmail: "Rollback",
          domaineEmail: "rollback.ma",
        },
        departements: ["RH", "RH"],
        admin: {
          email: "admin@rollback.ma",
          password: "password123",
          nom: "Test",
          prenom: "User",
          poste: "Admin",
          departementNom: "RH",
        },
      }),
    ).rejects.toThrow()

    const societeRows = await pgliteDb.select().from(schema.societes)
    expect(societeRows).toHaveLength(0)

    const deptRows = await pgliteDb.select().from(schema.departements)
    expect(deptRows).toHaveLength(0)

    const userRows = await pgliteDb.select().from(schema.utilisateurs)
    expect(userRows).toHaveLength(0)
  })

  it("after quitterAmorcage commits, loadSocieteIdentity returns fresh sender name", async () => {
    await quitterAmorcage({
      societe: {
        nom: "Cache Test Inc",
        nomExpediteurEmail: "Cache Test Sender",
        domaineEmail: "cache-test.ma",
      },
      departements: ["Support"],
      admin: {
        email: "admin@cache-test.ma",
        password: "password456",
        nom: "Martin",
        prenom: "Sophie",
        poste: "Administrateur",
        departementNom: "Support",
      },
    })

    const identity = await loadSocieteIdentity()
    expect(identity).toEqual({
      nomExpediteurEmail: "Cache Test Sender",
      domaineEmail: "noreply@cache-test.ma",
    })
  })
})
