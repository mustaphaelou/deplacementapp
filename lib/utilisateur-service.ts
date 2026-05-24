import type { PrismaClient, Utilisateur } from "@prisma/client"
import { hash, compare } from "bcryptjs"
import { prisma } from "./prisma"
import { auditBus } from "./audit-bus"
import {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
} from "./errors"

export {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
}

export class UtilisateurService {
  constructor(
    private db: PrismaClient,
    private audit = auditBus
  ) {}

  async list(): Promise<Utilisateur[]> {
    return this.db.utilisateur.findMany({
      include: { departement: { select: { id: true, nom: true } } },
      orderBy: { nom: "asc" },
    })
  }

  async create(
    data: {
      email: string
      motDePasse: string
      nom: string
      prenom: string
      poste: string
      role: string
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
        role: data.role as any,
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
      role?: string
      departementId?: string
      telephone?: string | null
    },
    actorId: string
  ): Promise<Utilisateur> {
    const updateData: Record<string, unknown> = { ...data }

    if (data.motDePasse) {
      updateData.motDePasse = await hash(data.motDePasse, 12)
    } else {
      delete updateData.motDePasse
    }

    try {
      const user = await this.db.utilisateur.update({
        where: { id },
        data: updateData as any,
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
      email?: string
      telephone?: string | null
      poste?: string
      avatarUrl?: string | null
    }
  ): Promise<Utilisateur> {
    try {
      const updated = await this.db.utilisateur.update({
        where: { id: userId },
        data: data as any,
        select: { id: true, email: true, telephone: true, poste: true, avatarUrl: true },
      })

      await this.audit.log({
        utilisateurId: userId,
        action: "MODIFICATION_PROFIL",
        entite: "Utilisateur",
        entiteId: updated.id,
        details: { champs: Object.keys(data) },
      })

      return updated as Utilisateur
    } catch {
      throw new UtilisateurNotFoundError()
    }
  }
}

export const utilisateurService = new UtilisateurService(prisma)
