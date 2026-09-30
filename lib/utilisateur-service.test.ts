import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { readFile } from "node:fs/promises"
import { sql, eq } from "drizzle-orm"
import * as schema from "../db/schema"
import { createPgliteDb } from "./test/create-pglite-db"
import type { PgliteDb } from "./test/create-pglite-db"
import * as auditModule from "./audit"
import { journalAudit } from "../db/schema/journal-audit"
import { utilisateurs } from "../db/schema/utilisateurs"
import { account } from "../db/schema/auth-tables"
import { CREDENTIAL_PROVIDER_ID } from "./auth/set-password"
import type { AvatarStorage } from "./avatar-storage"
import {
  UtilisateurService,
  UtilisateurNotFoundError,
} from "./utilisateur-service"
import type { ProfileResult } from "./utilisateur-service"

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed$"),
  compare: vi.fn(),
}))

import { hash, compare } from "bcryptjs"

const TIMEOUT = 30_000

// #288 — compile-time half of the "no fabricated count" pin.
//
// A type is erased at runtime, so no assertion inside `it()` can observe the
// DECLARED shape; only the value the read returns is visible to the suite.
// This alias is therefore the pin for the declaration, and `npm run typecheck`
// (part of the `verify` gate) is what enforces it.
//
// The assertion is POSITIVE — the exact key set — rather than a denylist of
// count-shaped names. A denylist can only catch the spellings it was written
// with, so `nombreDemandes` or `demandesTotal` would slip past both this and
// the runtime key check. Pinning the whole set means ANY field added to
// `ProfileResult` fails the build, which is what "cannot be re-added
// silently" actually asks for.
//
// Exported so `@typescript-eslint/no-unused-vars` does not flag it.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Assert<T extends true> = T
export type _PinProfileResultDeclaresNoCount = Assert<
  Equals<
    keyof ProfileResult,
    | "id"
    | "email"
    | "nom"
    | "prenom"
    | "poste"
    | "telephone"
    | "avatarUrl"
    | "role"
    | "departement"
    | "dateEmbauche"
    | "creeLe"
  >
>

function mockAvatarStorage(): AvatarStorage & {
  save: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
} {
  return {
    save: vi.fn().mockResolvedValue("/uploads/avatars/new.png"),
    delete: vi.fn().mockResolvedValue(undefined),
  } as any
}

function makeUser(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@test.com`,
    nom: "Dupont",
    prenom: "Jean",
    poste: "Dev",
    role: "EMPLOYEE" as const,
    societeId: "",
    departementId: "",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2025-01-01"),
    modifieLe: new Date("2025-01-01"),
    ...overrides,
  }
}

function makeActor() {
  return {
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@actor.com`,
    nom: "Admin",
    prenom: "User",
    poste: "Admin",
    role: "FINANCE_ADMIN" as const,
    societeId: "",
    departementId: "",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2025-01-01"),
    modifieLe: new Date("2025-01-01"),
  }
}

describe("UtilisateurService", { timeout: TIMEOUT }, () => {
  let pgliteDb: PgliteDb
  let svc: UtilisateurService
  let actor: ReturnType<typeof makeActor>
  let societeId: string
  let departementId: string

  beforeAll(async () => {
    pgliteDb = await createPgliteDb()
  })

  beforeEach(async () => {
    vi.clearAllMocks()

    await pgliteDb.execute(sql`DELETE FROM session`)
    await pgliteDb.execute(sql`DELETE FROM account`)
    await pgliteDb.execute(sql`DELETE FROM journal_audit`)
    await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
    await pgliteDb.execute(sql`DELETE FROM departements`)
    await pgliteDb.execute(sql`DELETE FROM societes`)

    societeId = crypto.randomUUID()
    departementId = crypto.randomUUID()
    actor = makeActor()

    await pgliteDb.insert(schema.societes).values({
      id: societeId,
      nom: "Test Societe",
      modifieLe: new Date(),
    })

    await pgliteDb.insert(schema.departements).values({
      id: departementId,
      nom: "Test Departement",
      societeId,
    })

    actor.societeId = societeId
    actor.departementId = departementId
    await pgliteDb.insert(schema.utilisateurs).values(actor)

    svc = new UtilisateurService(pgliteDb as any)
  })

  describe("list", () => {
    it("returns all utilisateurs with departement", async () => {
      const targetId = crypto.randomUUID()
      await pgliteDb.insert(schema.utilisateurs).values({
        ...makeUser(),
        id: targetId,
        email: `${crypto.randomUUID()}@test.com`,
        nom: "Smith",
        societeId,
        departementId,
      })

      const result = await svc.list()

      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.find((u) => u.id === targetId)?.nom).toBe("Smith")
    })
  })

  describe("findProfile", () => {
    it("returns the user profile with departement", async () => {
      const result = await svc.findProfile(actor.id)

      expect(result.id).toBe(actor.id)
      expect(result.nom).toBe("Admin")
      expect(result.departement).toEqual({ nom: "Test Departement" })
    })

    // #288. The read used to declare `_count: { demandes }` and return a
    // fabricated `0` for every Utilisateur, admitted by a blanket
    // `as unknown as ProfileResult`. Two pins, one per half of that:
    // this one for the value the read returns, the type pin below for the
    // shape it declares.
    it("returns no fabricated count key on the row", async () => {
      const result = await svc.findProfile(actor.id)

      // `_count` is the exact key the fabrication used; the pattern also
      // catches the obvious renames (demandesCount, nbDemandes).
      expect(Object.keys(result)).not.toContain("_count")
      expect(
        Object.keys(result).filter((k) => /count|demandes/i.test(k))
      ).toEqual([])
    })

    it("carries no blanket assertion: the selection satisfies the declaration", async () => {
      // If the read ever needs to reconcile its selection with ProfileResult
      // again, it must do so explicitly and locally. A blanket assertion is
      // exactly what let the fabricated `_count` through, so the source of
      // findProfile is pinned to contain no `as unknown as`.
      const source = await readFile(
        new URL("./utilisateur-service.ts", import.meta.url),
        "utf8"
      )
      const start = source.indexOf("async findProfile")
      const end = source.indexOf("async create")
      // The anchors are asserted BEFORE slicing. `indexOf` answers -1 when a
      // needle is absent, and `slice` then yields "" — against which both
      // `not.toContain` assertions pass trivially. Without these two, a rename
      // of `findProfile` or a reorder that put `create` above it would silently
      // disarm this pin rather than fail it.
      expect(start).toBeGreaterThan(-1)
      expect(end).toBeGreaterThan(start)
      const findProfileBody = source.slice(start, end)
      expect(findProfileBody.length).toBeGreaterThan(0)

      expect(findProfileBody).not.toContain("as unknown as")
      expect(findProfileBody).not.toContain("_count")
    })

    it("throws UtilisateurNotFoundError when user is not found", async () => {
      await expect(svc.findProfile("u-missing")).rejects.toThrow(
        UtilisateurNotFoundError
      )
    })
  })

  describe("create", () => {
    it("inserts a user row and writes journal_audit", async () => {
      const result = await svc.create(
        {
          email: "new@test.com",
          nom: "Test",
          prenom: "User",
          poste: "QA",
          role: "EMPLOYEE",
          departementId,
        },
        actor.id
      )

      expect(result.email).toBe("new@test.com")
      expect(hash).toHaveBeenCalledWith("password123", 12)

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, result.id))
      expect(row).toBeDefined()
      expect(row.email).toBe("new@test.com")
      // The administrator's provisioning act is the e-mail attestation: it is
      // written by the service, never hand-set and never a toggle.
      expect(row.emailVerified).toBe(true)

      // The deployment's Societe is resolved behind the seam (ADR-0018):
      // the input carried no societeId.
      expect(row.societeId).toBe(societeId)

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, result.id))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actor.id)
      expect(auditRow.action).toBe("CREATION_UTILISATEUR")
    })

    it("rolls back when logAudit fails (no rows inserted)", async () => {
      const spy = vi
        .spyOn(auditModule, "logAudit")
        .mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.create(
          {
            email: "rollback@test.com",
            nom: "Rollback",
            prenom: "Test",
            poste: "QA",
            role: "EMPLOYEE",
            departementId,
          },
          actor.id
        )
      ).rejects.toThrow("audit failure")

      const rows = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.email, "rollback@test.com"))
      expect(rows).toHaveLength(0)

      spy.mockRestore()
    })

    it("hashes provided password", async () => {
      await svc.create(
        {
          email: "pw@test.com",
          motDePasse: "secret123",
          nom: "Test",
          prenom: "User",
          poste: "QA",
          role: "EMPLOYEE",
          departementId,
        },
        actor.id
      )

      expect(hash).toHaveBeenCalledWith("secret123", 12)
    })

    it("refuses when no Societe exists (unreachable after Amorçage)", async () => {
      await pgliteDb.execute(sql`DELETE FROM account`)
      await pgliteDb.execute(sql`DELETE FROM journal_audit`)
      await pgliteDb.execute(sql`DELETE FROM utilisateurs`)
      await pgliteDb.execute(sql`DELETE FROM departements`)
      await pgliteDb.execute(sql`DELETE FROM societes`)

      await expect(
        svc.create(
          {
            email: "no-societe@test.com",
            nom: "Test",
            prenom: "User",
            poste: "QA",
            role: "EMPLOYEE",
            departementId,
          },
          actor.id
        )
      ).rejects.toThrow("Aucune société configurée")
    })
  })

  describe("update", () => {
    let targetUser: ReturnType<typeof makeUser>

    beforeEach(async () => {
      targetUser = makeUser({ societeId, departementId })
      targetUser.email = `${crypto.randomUUID()}@target.com`
      await pgliteDb.insert(schema.utilisateurs).values(targetUser)
    })

    it("updates a user row and writes journal_audit", async () => {
      const result = await svc.update(
        targetUser.id,
        { email: "updated@test.com", nom: "Updated" },
        actor.id
      )

      expect(result.email).toBe("updated@test.com")

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.nom).toBe("Updated")
      expect(row.email).toBe("updated@test.com")

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, targetUser.id))
      expect(auditRow).toBeDefined()
      expect(auditRow.utilisateurId).toBe(actor.id)
      expect(auditRow.action).toBe("MODIFICATION_UTILISATEUR")
    })

    it("rolls back when logAudit fails (original values preserved)", async () => {
      const spy = vi
        .spyOn(auditModule, "logAudit")
        .mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.update(targetUser.id, { nom: "Should Not Stick" }, actor.id)
      ).rejects.toThrow("audit failure")

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.nom).toBe(targetUser.nom)

      spy.mockRestore()
    })

    it("throws UtilisateurNotFoundError when user does not exist", async () => {
      await expect(
        svc.update("u-missing", { nom: "Ghost" }, actor.id)
      ).rejects.toThrow(UtilisateurNotFoundError)
    })
  })

  describe("changePassword", () => {
    let targetUser: ReturnType<typeof makeUser>

    beforeEach(async () => {
      targetUser = makeUser({
        societeId,
        departementId,
      })
      targetUser.email = `${crypto.randomUUID()}@target.com`
      await pgliteDb.insert(schema.utilisateurs).values(targetUser)
      await pgliteDb.insert(account).values({
        id: crypto.randomUUID(),
        accountId: targetUser.id,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId: targetUser.id,
        password: "$hashed$",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it("updates the credential row and writes journal_audit", async () => {
      ;(compare as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(hash as ReturnType<typeof vi.fn>).mockResolvedValue("$newhash$")

      await svc.changePassword(targetUser.id, "correctpass", "newpass")

      const [cred] = await pgliteDb
        .select()
        .from(account)
        .where(eq(account.userId, targetUser.id))
        .limit(1)
      expect(cred.password).toBe("$newhash$")

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, targetUser.id))
      expect(auditRow).toBeDefined()
      expect(auditRow.action).toBe("CHANGEMENT_MOT_DE_PASSE")
    })

    it("rolls back when logAudit fails (credential row unchanged)", async () => {
      ;(compare as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(hash as ReturnType<typeof vi.fn>).mockResolvedValue("$newhash$")
      const spy = vi
        .spyOn(auditModule, "logAudit")
        .mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.changePassword(targetUser.id, "correctpass", "newpass")
      ).rejects.toThrow("audit failure")

      const [cred] = await pgliteDb
        .select()
        .from(account)
        .where(eq(account.userId, targetUser.id))
        .limit(1)
      expect(cred.password).toBe("$hashed$")

      spy.mockRestore()
    })
  })

  describe("updateProfile", () => {
    let targetUser: ReturnType<typeof makeUser>

    beforeEach(async () => {
      targetUser = makeUser({
        societeId,
        departementId,
      })
      targetUser.email = `${crypto.randomUUID()}@target.com`
      await pgliteDb.insert(schema.utilisateurs).values(targetUser)
    })

    it("updates profile fields and writes journal_audit", async () => {
      const result = await svc.updateProfile(targetUser.id, {
        telephone: "0612345678",
        poste: "Lead",
      })

      expect(result.telephone).toBe("0612345678")
      expect(result.poste).toBe("Lead")

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.telephone).toBe("0612345678")
      expect(row.poste).toBe("Lead")

      const [auditRow] = await pgliteDb
        .select()
        .from(journalAudit)
        .where(eq(journalAudit.entiteId, targetUser.id))
      expect(auditRow).toBeDefined()
      expect(auditRow.action).toBe("MODIFICATION_PROFIL")
    })

    it("rolls back when logAudit fails (original values preserved)", async () => {
      const spy = vi
        .spyOn(auditModule, "logAudit")
        .mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svc.updateProfile(targetUser.id, { poste: "Should Not Stick" })
      ).rejects.toThrow("audit failure")

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.poste).toBe(targetUser.poste)

      spy.mockRestore()
    })

    it("saves new avatar before transaction, deletes old after commit", async () => {
      const oldUrl = "/uploads/avatars/old.png"
      const avatarStorage = mockAvatarStorage()

      await pgliteDb
        .update(utilisateurs)
        .set({ avatarUrl: oldUrl })
        .where(eq(utilisateurs.id, targetUser.id))

      const svcWithAvatar = new UtilisateurService(
        pgliteDb as any,
        avatarStorage
      )

      await svcWithAvatar.updateProfile(targetUser.id, {
        avatarData: "data:image/png;base64,new",
      })

      expect(avatarStorage.save).toHaveBeenCalledWith(
        "data:image/png;base64,new",
        targetUser.id
      )
      expect(avatarStorage.delete).toHaveBeenCalledWith(oldUrl)

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.avatarUrl).toBe("/uploads/avatars/new.png")
    })

    it("rolls back avatar change and harvests orphan file on audit failure", async () => {
      const oldUrl = "/uploads/avatars/old.png"
      const avatarStorage = mockAvatarStorage()

      await pgliteDb
        .update(utilisateurs)
        .set({ avatarUrl: oldUrl })
        .where(eq(utilisateurs.id, targetUser.id))

      const svcWithAvatar = new UtilisateurService(
        pgliteDb as any,
        avatarStorage
      )

      const spy = vi
        .spyOn(auditModule, "logAudit")
        .mockRejectedValueOnce(new Error("audit failure"))

      await expect(
        svcWithAvatar.updateProfile(targetUser.id, {
          avatarData: "data:image/png;base64,new",
        })
      ).rejects.toThrow("audit failure")

      expect(avatarStorage.save).toHaveBeenCalled()
      expect(avatarStorage.delete).toHaveBeenCalledWith(
        "/uploads/avatars/new.png"
      )
      expect(avatarStorage.delete).not.toHaveBeenCalledWith(oldUrl)

      const [row] = await pgliteDb
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, targetUser.id))
      expect(row.avatarUrl).toBe(oldUrl)

      spy.mockRestore()
    })

    it("clears avatar without saving a file when avatarData is empty", async () => {
      const oldUrl = "/uploads/avatars/old.png"
      const avatarStorage = mockAvatarStorage()

      await pgliteDb
        .update(utilisateurs)
        .set({ avatarUrl: oldUrl })
        .where(eq(utilisateurs.id, targetUser.id))

      const svcWithAvatar = new UtilisateurService(
        pgliteDb as any,
        avatarStorage
      )

      const result = await svcWithAvatar.updateProfile(targetUser.id, {
        avatarData: "",
      })

      expect(avatarStorage.save).not.toHaveBeenCalled()
      expect(avatarStorage.delete).toHaveBeenCalledWith(oldUrl)
      expect(result.avatarUrl).toBeNull()
    })
  })
})
