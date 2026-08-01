import { eq, asc } from "drizzle-orm"
import { hash, compare } from "bcryptjs"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { utilisateurs } from "../db/schema/utilisateurs"
import { logAudit } from "./audit"
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
  role: string
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
    private _db: DrizzleDb,
    private avatarStorage: AvatarStorage = defaultAvatarStorage
  ) {}

  async list() {
    return this._db.query.utilisateurs.findMany({
      with: { departement: { columns: { id: true, nom: true } } },
      orderBy: [asc(utilisateurs.nom)],
    })
  }

  async findProfile(userId: string): Promise<ProfileResult> {
    const user = await this._db.query.utilisateurs.findFirst({
      where: eq(utilisateurs.id, userId),
      with: {
        departement: { columns: { nom: true } },
      },
    })
    if (!user) throw new UtilisateurNotFoundError()
    return {
      ...user,
      _count: { demandes: 0 },
    } as unknown as ProfileResult
  }

  async create(
    data: {
      email: string
      motDePasse?: string
      nom: string
      prenom: string
      poste: string
      role: string
      societeId: string
      departementId: string
      telephone?: string
      googleAuthEnabled?: boolean
    },
    actorId: string
  ) {
    const password = data.motDePasse || "password123"
    const hashedPassword = await hash(password, 12)
    const userId = crypto.randomUUID()

    return this._db.transaction(async (tx) => {
      const [user] = await tx
        .insert(utilisateurs)
        .values({
          id: userId,
          email: data.email,
          motDePasse: hashedPassword,
          googleAuthEnabled: data.googleAuthEnabled ?? false,
          nom: data.nom,
          prenom: data.prenom,
          poste: data.poste,
          role: data.role as
            | "EMPLOYEE"
            | "MANAGER"
            | "FINANCE_ADMIN"
            | "GENERAL_DIRECTION",
          societeId: data.societeId,
          departementId: data.departementId,
          telephone: data.telephone || null,
          modifieLe: new Date(),
        })
        .returning()

      await logAudit(
        {
          utilisateurId: actorId,
          action: "CREATION_UTILISATEUR",
          entite: "Utilisateur",
          entiteId: user.id,
          details: { email: user.email },
        },
        tx
      )

      return user
    })
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
      googleAuthEnabled?: boolean
    },
    actorId: string
  ) {
    const { motDePasse, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (motDePasse) {
      updateData.motDePasse = await hash(motDePasse, 12)
    }

    return this._db.transaction(async (tx) => {
      const [user] = await tx
        .update(utilisateurs)
        .set(updateData)
        .where(eq(utilisateurs.id, id))
        .returning()

      if (!user) throw new UtilisateurNotFoundError()

      await logAudit(
        {
          utilisateurId: actorId,
          action: "MODIFICATION_UTILISATEUR",
          entite: "Utilisateur",
          entiteId: user.id,
          details: { email: user.email },
        },
        tx
      )

      return user
    })
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const [user] = await this._db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, userId))
      .limit(1)
    if (!user) throw new UtilisateurNotFoundError()
    if (!user.motDePasse) throw new MotDePasseIncorrectError()

    const isValid = await compare(currentPassword, user.motDePasse)
    if (!isValid) throw new MotDePasseIncorrectError()

    const hashed = await hash(newPassword, 12)

    await this._db.transaction(async (tx) => {
      await tx
        .update(utilisateurs)
        .set({ motDePasse: hashed })
        .where(eq(utilisateurs.id, userId))

      await logAudit(
        {
          utilisateurId: userId,
          action: "CHANGEMENT_MOT_DE_PASSE",
          entite: "Utilisateur",
          entiteId: userId,
        },
        tx
      )
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
  ) {
    const [user] = await this._db
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.id, userId))
      .limit(1)
    if (!user) throw new UtilisateurNotFoundError()

    const updateData: Record<string, unknown> = {}

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
      if (!user.motDePasse) throw new MotDePasseIncorrectError()
      const isValid = await compare(data.currentPassword, user.motDePasse)
      if (!isValid) throw new MotDePasseIncorrectError()
      updateData.email = data.email
    }

    const previousAvatarUrl: string | null = user.avatarUrl
    let savedNewAvatar = false

    if (data.avatarData !== undefined) {
      if (data.avatarData) {
        updateData.avatarUrl = await this.avatarStorage.save(
          data.avatarData,
          userId
        )
        savedNewAvatar = true
      } else {
        updateData.avatarUrl = null
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new NoProfileUpdateDataError()
    }

    try {
      const result = await this._db.transaction(async (tx) => {
        const [updated] = await tx
          .update(utilisateurs)
          .set(updateData)
          .where(eq(utilisateurs.id, userId))
          .returning({
            id: utilisateurs.id,
            email: utilisateurs.email,
            telephone: utilisateurs.telephone,
            poste: utilisateurs.poste,
            avatarUrl: utilisateurs.avatarUrl,
          })

        if (!updated) throw new UtilisateurNotFoundError()

        await logAudit(
          {
            utilisateurId: userId,
            action: "MODIFICATION_PROFIL",
            entite: "Utilisateur",
            entiteId: updated.id,
            details: { champs: Object.keys(updateData) },
          },
          tx
        )

        return updated
      })

      if (previousAvatarUrl && data.avatarData !== undefined) {
        await this.avatarStorage.delete(previousAvatarUrl)
      }

      return result
    } catch (err) {
      if (savedNewAvatar) {
        await this.avatarStorage.delete(updateData.avatarUrl as string)
      }
      throw err
    }
  }
}

export const utilisateurService = new UtilisateurService(db)
