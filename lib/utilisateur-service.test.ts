import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  UtilisateurService,
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
} from "./utilisateur-service"
import type { AuditBus } from "./audit-bus"
import type { Prisma, PrismaClient, Utilisateur } from "@prisma/client"
import type { AvatarStorage } from "./avatar-storage"

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

function mockAvatarStorage(): AvatarStorage & {
  save: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
} {
  return {
    save: vi.fn().mockResolvedValue("/uploads/avatars/new.png"),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as AvatarStorage & {
    save: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
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
  societeId: "default",
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
          societeId: "default",
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
          societeId: "default",
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

  describe("findProfile", () => {
    it("returns the user profile with departement and demande count", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue({
        ...makeUser(),
        departement: { nom: "IT" },
        _count: { demandes: 5 },
      })

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      const result = await svc.findProfile("u-1")

      expect(result.id).toBe("u-1")
      expect(result.email).toBe("jean@example.com")
      expect(result.nom).toBe("Dupont")
      expect(result.prenom).toBe("Jean")
      expect(result.poste).toBe("Dev")
      expect(result.telephone).toBeNull()
      expect(result.avatarUrl).toBeNull()
      expect(result.role).toBe("EMPLOYEE")
      expect(result.departement).toEqual({ nom: "IT" })
      expect(result.dateEmbauche).toBeNull()
      expect(result.creeLe).toEqual(new Date("2025-01-01"))
      expect(result._count).toEqual({ demandes: 5 })
      expect(db.utilisateur.findUnique).toHaveBeenCalledWith({
        where: { id: "u-1" },
        include: {
          departement: { select: { nom: true } },
          _count: { select: { demandes: true } },
        },
      })
    })

    it("throws UtilisateurNotFoundError when user is not found", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(null)

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(svc.findProfile("u-missing")).rejects.toThrow(UtilisateurNotFoundError)
    })
  })

  describe("updateProfile", () => {
    it("updates profile fields and audits", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.findUnique.mockResolvedValue(makeUser())
      db.utilisateur.update.mockResolvedValue(
        makeUser({ telephone: "0612345678", poste: "Lead" })
      )

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      const result = await svc.updateProfile("u-1", {
        telephone: "0612345678",
        poste: "Lead",
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
      db.utilisateur.findUnique.mockResolvedValue(makeUser())
      db.utilisateur.update.mockImplementation((args: { data: Prisma.UtilisateurUpdateInput }) =>
        Promise.resolve(makeUser(args.data as Partial<Utilisateur>))
      )

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      const result = await svc.updateProfile("u-1", { telephone: null })

      expect(result.telephone).toBeNull()
    })

    it("throws UtilisateurNotFoundError when user is missing", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(null)

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.updateProfile("u-missing", { poste: "Ghost" })
      ).rejects.toThrow(UtilisateurNotFoundError)
    })

    it("verifies current password and updates email when correct", async () => {
      const db = mockDb()
      const audit = mockAudit()
      db.utilisateur.findUnique.mockResolvedValue(makeUser({ motDePasse: "$oldhash$" }))
      ;(compare as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      db.utilisateur.update.mockResolvedValue(makeUser({ email: "new@test.com" }))

      const svc = new UtilisateurService(db as unknown as PrismaClient, audit)
      const result = await svc.updateProfile("u-1", {
        email: "new@test.com",
        currentPassword: "oldpass",
      })

      expect(compare).toHaveBeenCalledWith("oldpass", "$oldhash$")
      expect(result.email).toBe("new@test.com")
    })

    it("throws MotDePasseIncorrectError when current password is wrong", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(makeUser({ motDePasse: "$oldhash$" }))
      ;(compare as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.updateProfile("u-1", { email: "new@test.com", currentPassword: "wrongpass" })
      ).rejects.toThrow(MotDePasseIncorrectError)
    })

    it("throws EmailChangeRequiresPasswordError when email is provided without password", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(makeUser())

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(
        svc.updateProfile("u-1", { email: "new@test.com" })
      ).rejects.toThrow(EmailChangeRequiresPasswordError)
    })

    it("deletes old avatar and saves new avatar when avatarData is provided", async () => {
      const db = mockDb()
      const audit = mockAudit()
      const avatarStorage = mockAvatarStorage()
      db.utilisateur.findUnique.mockResolvedValue(
        makeUser({ avatarUrl: "/uploads/avatars/old.png" })
      )
      db.utilisateur.update.mockResolvedValue(makeUser({ avatarUrl: "/uploads/avatars/new.png" }))

      const svc = new UtilisateurService(
        db as unknown as PrismaClient,
        audit,
        avatarStorage
      )
      const result = await svc.updateProfile("u-1", { avatarData: "data:image/png;base64,abc" })

      expect(avatarStorage.delete).toHaveBeenCalledWith("/uploads/avatars/old.png")
      expect(avatarStorage.save).toHaveBeenCalledWith("data:image/png;base64,abc", "u-1")
      expect(result.avatarUrl).toBe("/uploads/avatars/new.png")
    })

    it("removes avatar when avatarData is empty", async () => {
      const db = mockDb()
      const avatarStorage = mockAvatarStorage()
      db.utilisateur.findUnique.mockResolvedValue(
        makeUser({ avatarUrl: "/uploads/avatars/old.png" })
      )
      db.utilisateur.update.mockImplementation((args: { data: Prisma.UtilisateurUpdateInput }) =>
        Promise.resolve(makeUser(args.data as Partial<Utilisateur>))
      )

      const svc = new UtilisateurService(
        db as unknown as PrismaClient,
        mockAudit(),
        avatarStorage
      )
      const result = await svc.updateProfile("u-1", { avatarData: "" })

      expect(avatarStorage.delete).toHaveBeenCalledWith("/uploads/avatars/old.png")
      expect(avatarStorage.save).not.toHaveBeenCalled()
      expect(result.avatarUrl).toBeNull()
    })

    it("throws NoProfileUpdateDataError when no fields are provided", async () => {
      const db = mockDb()
      db.utilisateur.findUnique.mockResolvedValue(makeUser())

      const svc = new UtilisateurService(db as unknown as PrismaClient, mockAudit())
      await expect(svc.updateProfile("u-1", {})).rejects.toThrow(NoProfileUpdateDataError)
    })
  })
})
