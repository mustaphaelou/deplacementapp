import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  UtilisateurService,
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
} from "./utilisateur-service"
import type { AuditBus } from "./audit-bus"
import type { PrismaClient, Utilisateur } from "@prisma/client"

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed$"),
  compare: vi.fn(),
}))

import { hash, compare } from "bcryptjs"

function mockAudit(): AuditBus & { log: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditBus & { log: ReturnType<typeof vi.fn> }
}

interface MockedDb {
  utilisateur: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function mockDb(): MockedDb {
  return {
    utilisateur: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

const makeUser = (overrides?: Partial<Utilisateur>): Utilisateur => ({
  id: "u-1",
  email: "jean@example.com",
  motDePasse: "$oldhash$",
  nom: "Dupont",
  prenom: "Jean",
  poste: "Dev",
  role: "EMPLOYEE",
  departementId: "d-1",
  avatarUrl: null,
  telephone: null,
  dateEmbauche: null,
  actif: true,
  creeLe: new Date("2025-01-01"),
  modifieLe: new Date("2025-01-01"),
  ...overrides,
})

describe("UtilisateurService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("list", () => {
    it("lists all utilisateurs with departement", async () => {
      const db = mockDb()
      db.utilisateur.findMany.mockResolvedValue([makeUser()])

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      const result = await svc.list()

      expect(result).toHaveLength(1)
      expect(db.utilisateur.findMany).toHaveBeenCalledWith({
        include: { departement: { select: { id: true, nom: true } } },
        orderBy: { nom: "asc" },
      })
    })
  })

  describe("create", () => {
    it("hashes password and creates user with audit", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.create.mockResolvedValue(makeUser({ email: "test@test.com" }))

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      const result = await svc.create(
        {
          email: "test@test.com",
          motDePasse: "secret123",
          nom: "Test",
          prenom: "User",
          poste: "QA",
          role: "EMPLOYEE",
          departementId: "d-1",
        },
        "u-1"
      )

      expect(hash).toHaveBeenCalledWith("secret123", 12)
      expect(result.email).toBe("test@test.com")
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          utilisateurId: "u-1",
          action: "CREATION_UTILISATEUR",
          entite: "Utilisateur",
        })
      )
    })

    it("uses default password when none provided", async () => {
      const db = mockDb()
      db.utilisateur.create.mockResolvedValue(makeUser())

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await svc.create(
        {
          email: "test@test.com",
          motDePasse: "",
          nom: "Test",
          prenom: "User",
          poste: "QA",
          role: "EMPLOYEE",
          departementId: "d-1",
        },
        "u-1"
      )

      expect(hash).toHaveBeenCalledWith("password123", 12)
    })
  })

  describe("update", () => {
    it("updates user without changing password when not provided", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.update.mockResolvedValue(makeUser({ email: "updated@test.com" }))

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      const result = await svc.update(
        "u-1",
        { email: "updated@test.com", nom: "Updated" },
        "u-1"
      )

      expect(hash).not.toHaveBeenCalled()
      expect(result.email).toBe("updated@test.com")
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MODIFICATION_UTILISATEUR",
        })
      )
    })

    it("hashes password when provided in update", async () => {
      const db = mockDb()
      db.utilisateur.update.mockResolvedValue(makeUser())

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await svc.update(
        "u-1",
        { motDePasse: "newpass" },
        "u-1"
      )

      expect(hash).toHaveBeenCalledWith("newpass", 12)
    })

    it("throws UtilisateurNotFoundError on missing user", async () => {
      const db = mockDb()
      db.utilisateur.update.mockRejectedValue(new Error("Record to update not found"))

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.update("u-missing", { nom: "Ghost" }, "u-1")
      ).rejects.toThrow(UtilisateurNotFoundError)
    })
  })

  describe("changePassword", () => {
    it("changes password when current is correct", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.findUnique.mockResolvedValue(makeUser({ id: "u-1", motDePasse: "$oldhash$" }));
      (compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (hash as ReturnType<typeof vi.fn>).mockResolvedValue("$newhash$")

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      await svc.changePassword("u-1", "oldpass", "newpass")

      expect(compare).toHaveBeenCalledWith("oldpass", "$oldhash$")
      expect(hash).toHaveBeenCalledWith("newpass", 12)
      expect(db.utilisateur.update).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: { motDePasse: "$newhash$" },
      })
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CHANGEMENT_MOT_DE_PASSE",
          entite: "Utilisateur",
          entiteId: "u-1",
        })
      )
    })

    it("throws UtilisateurNotFoundError when user not found", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(null)

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.changePassword("u-missing", "old", "new")
      ).rejects.toThrow(UtilisateurNotFoundError)
    })

    it("throws MotDePasseIncorrectError when current password is wrong", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(makeUser({ id: "u-1", motDePasse: "$oldhash$" }));
      (compare as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.changePassword("u-1", "wrongpass", "newpass")
      ).rejects.toThrow(MotDePasseIncorrectError)
    })
  })

  describe("updateProfile", () => {
    it("updates profile fields and audits", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.update.mockResolvedValue(
        makeUser({ telephone: "0612345678", poste: "Lead", avatarUrl: "/uploads/avatars/avatar.png" })
      )

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      const result = await svc.updateProfile("u-1", {
        telephone: "0612345678",
        poste: "Lead",
        email: "new@test.com",
        avatarUrl: "/uploads/avatars/avatar.png",
      })

      expect(result.telephone).toBe("0612345678")
      expect(result.poste).toBe("Lead")
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MODIFICATION_PROFIL",
          entite: "Utilisateur",
          entiteId: "u-1",
        })
      )
    })

    it("allows setting telephone to null", async () => {
      const db = mockDb()
      db.utilisateur.update.mockImplementation((args: any) =>
        Promise.resolve(makeUser(args.data))
      )

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      const result = await svc.updateProfile("u-1", { telephone: null })

      expect(result.telephone).toBeNull()
    })

    it("throws UtilisateurNotFoundError on missing user", async () => {
      const db = mockDb()
      db.utilisateur.update.mockRejectedValue(new Error("Record to update not found"))

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.updateProfile("u-missing", { poste: "Ghost" })
      ).rejects.toThrow(UtilisateurNotFoundError)
    })
  })
})
