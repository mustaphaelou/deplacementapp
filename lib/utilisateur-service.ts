import { Prisma, type PrismaClient, type Utilisateur, type Role } from "@prisma/client"
import { hash, compare } from "bcryptjs"
import { prisma } from "./prisma"
import { auditBus } from "./audit-bus"
import {
  avatarStorage as defaultAvatarStorage,
  type AvatarStorage,
} from "./avatar-storage"
import {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
  AvatarError,
} from "./errors"

export interface ProfileResult {
  id: string
  email: string
  nom: string
  prenom: string
  poste: string
  telephone: string | null
  avatarUrl: string | null
  role: Role
  departement: { nom: string }
  dateEmbauche: Date | null
  creeLe: Date
  _count: { demandes: number }
}

export {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
  AvatarError,
}

export class UtilisateurService {
  constructor(
    private db: PrismaClient,
    private audit = auditBus,
    private avatarStorage: AvatarStorage = defaultAvatarStorage
  ) {}

  async list(): Promise<Utilisateur[]> {
    return this.db.utilisateur.findMany({
      include: { departement: { select: { id: true, nom: true } } },
      orderBy: { nom: "asc" },
    })
  }

  async findProfile(userId: string): Promise<ProfileResult> {
    const user = await this.db.utilisateur.findUnique({
      where: { id: userId },
      include: {
        departement: { select: { nom: true } },
        _count: { select: { demandes: true } },
      },
    })
    if (!user) throw new UtilisateurNotFoundError()
    return user as unknown as ProfileResult
  }

  async create(
    data: {
      email: string
      motDePasse: string
      nom: string
      prenom: string
      poste: string
      role: Role
      societeId: string
      departementId: string
      telephone?: string
    },
    actorId: string
  ): Promise<Utilisateur> {
    const hashedPassword = await hash(data.motDePasse || "password123", 12)

    const user = await this.db.utilisateur.create({
      data: {
        email: data.email,
        motDePasse: hashedPassword,
        nom: data.nom,
        prenom: data.prenom,
        poste: data.poste,
        role: data.role,
        societeId: data.societeId,
        departementId: data.departementId,
        telephone: data.telephone || null,
      },
    })

    await this.audit.log({
      utilisateurId: actorId,
      action: "CREATION_UTILISATEUR",
      entite: "Utilisateur",
      entiteId: user.id,
      details: { email: user.email },
    })

    return user
  }

  async update(
    id: string,
    data: {
      email?: string
      motDePasse?: string
      nom?: string
      prenom?: string
      poste?: string
      role?: Role
      departementId?: string
      telephone?: string | null
    },
    actorId: string
  ): Promise<Utilisateur> {
    const { motDePasse, ...rest } = data
    const updateData: Prisma.UtilisateurUpdateInput = {
      ...rest,
      ...(motDePasse ? { motDePasse: await hash(motDePasse, 12) } : {}),
    }

    try {
      const user = await this.db.utilisateur.update({
        where: { id },
        data: updateData,
      })

      await this.audit.log({
        utilisateurId: actorId,
        action: "MODIFICATION_UTILISATEUR",
        entite: "Utilisateur",
        entiteId: user.id,
        details: { email: user.email },
      })

      return user
    } catch {
      throw new UtilisateurNotFoundError()
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.db.utilisateur.findUnique({
      where: { id: userId },
    })
    if (!user) throw new UtilisateurNotFoundError()

    const isValid = await compare(currentPassword, user.motDePasse)
    if (!isValid) throw new MotDePasseIncorrectError()

    const hashed = await hash(newPassword, 12)

    await this.db.utilisateur.update({
      where: { id: userId },
      data: { motDePasse: hashed },
    })

    await this.audit.log({
      utilisateurId: userId,
      action: "CHANGEMENT_MOT_DE_PASSE",
      entite: "Utilisateur",
      entiteId: userId,
    })
  }

  async updateProfile(
    userId: string,
    data: {
      telephone?: string | null
      poste?: string
      email?: string
      currentPassword?: string
      avatarData?: string
    }
  ): Promise<Pick<Utilisateur, "id" | "email" | "telephone" | "poste" | "avatarUrl">> {
    const user = await this.db.utilisateur.findUnique({
      where: { id: userId },
    })
    if (!user) throw new UtilisateurNotFoundError()

    const updateData: Prisma.UtilisateurUpdateInput = {}

    if (data.telephone !== undefined) {
      updateData.telephone = data.telephone || null
    }

    if (data.poste !== undefined) {
      updateData.poste = data.poste
    }

    if (data.email !== undefined) {
      if (!data.currentPassword) {
        throw new EmailChangeRequiresPasswordError()
      }
      const isValid = await compare(data.currentPassword, user.motDePasse)
      if (!isValid) throw new MotDePasseIncorrectError()
      updateData.email = data.email
    }

    if (data.avatarData !== undefined) {
      if (user.avatarUrl) {
        await this.avatarStorage.delete(user.avatarUrl)
      }
      updateData.avatarUrl = data.avatarData
        ? await this.avatarStorage.save(data.avatarData, userId)
        : null
    }

    if (Object.keys(updateData).length === 0) {
      throw new NoProfileUpdateDataError()
    }

    try {
      const updated = await this.db.utilisateur.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, email: true, telephone: true, poste: true, avatarUrl: true },
      })

      await this.audit.log({
        utilisateurId: userId,
        action: "MODIFICATION_PROFIL",
        entite: "Utilisateur",
        entiteId: updated.id,
        details: { champs: Object.keys(updateData) },
      })

      return updated
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new UtilisateurNotFoundError()
      }
      throw e
    }
  }
}

export const utilisateurService = new UtilisateurService(prisma)
