import { eq, asc } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { db } from "../db"
import { utilisateurs } from "../db/schema/utilisateurs"
import { logAudit } from "./audit"
import { setPassword, verifyCredential } from "./auth/set-password"
import {
  avatarStorage as defaultAvatarStorage,
  type AvatarStorage,
} from "./avatar-storage"
import { getSocieteRow } from "./societe"
import {
  AUCUNE_SOCIETE_CONFIGUREE,
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
  AvatarError,
  UnauthorizedActionError,
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
  UnauthorizedActionError,
}

const DEFAULT_PASSWORD = "password123"

// Grant rules for role administration (#236): the route gate
// (FINANCE_ADMIN / GENERAL_DIRECTION) stays, and the service enforces who
// may assign which role. FINANCE_ADMIN manages EMPLOYEE / MANAGER only — it
// may neither create a GENERAL_DIRECTION (nor a peer FINANCE_ADMIN) nor
// touch an existing one — and nobody may change their own role (a
// self-promotion to GENERAL_DIRECTION would capture DIRECTION_REVIEW final
// approval).
const ROLES_GERABLES_PAR_FINANCE_ADMIN: readonly string[] = [
  "EMPLOYEE",
  "MANAGER",
]
const ROLES_ADMINISTRATION: readonly string[] = [
  "FINANCE_ADMIN",
  "GENERAL_DIRECTION",
]

function assertGrantAdministration(
  actor: { id: string; role: string } | undefined,
  cibleRoleActuel: string | null,
  roleDemande: string | undefined,
  cibleId: string | null,
  actorId: string
): void {
  if (!actor || !ROLES_ADMINISTRATION.includes(actor.role)) {
    throw new UnauthorizedActionError("Action non autorisée")
  }
  if (
    cibleId !== null &&
    cibleId === actorId &&
    roleDemande !== undefined &&
    roleDemande !== cibleRoleActuel
  ) {
    throw new UnauthorizedActionError(
      "Vous ne pouvez pas modifier votre propre rôle"
    )
  }
  if (actor.role === "FINANCE_ADMIN") {
    // Self-edits are exempt from the tier check below: they may only touch
    // non-role fields (any actual role change was already refused above), so
    // an admin can still update their own profile through the full-schema
    // PUT without resubmitting their role becoming a 403.
    const isSelf = cibleId !== null && cibleId === actorId
    if (!isSelf) {
      if (
        cibleRoleActuel !== null &&
        !ROLES_GERABLES_PAR_FINANCE_ADMIN.includes(cibleRoleActuel)
      ) {
        throw new UnauthorizedActionError(
          "Vous ne pouvez pas gérer un utilisateur de ce rôle"
        )
      }
      if (
        roleDemande !== undefined &&
        !ROLES_GERABLES_PAR_FINANCE_ADMIN.includes(roleDemande)
      ) {
        throw new UnauthorizedActionError(
          "Vous ne pouvez pas attribuer ce rôle"
        )
      }
    }
  }
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
      departementId: string
      telephone?: string
      googleAuthEnabled?: boolean
    },
    actorId: string
  ) {
    const password = data.motDePasse || DEFAULT_PASSWORD
    const userId = crypto.randomUUID()

    return this._db.transaction(async (tx) => {
      // The deployment has exactly one Societe, with an id no caller can know
      // (ADR-0018): resolve it behind the seam, inside the same transaction.
      const societe = await getSocieteRow(tx)
      if (!societe) {
        // Unreachable after Amorçage — same impossible-state contract as
        // updateSociete.
        throw new Error(AUCUNE_SOCIETE_CONFIGUREE)
      }

      // Grant rules (#236): resolve the actor's role behind the seam and
      // refuse cross-tier / self grants before writing anything.
      const [actor] = await tx
        .select({ id: utilisateurs.id, role: utilisateurs.role })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, actorId))
        .limit(1)
      assertGrantAdministration(actor, null, data.role, null, actorId)

      const [user] = await tx
        .insert(utilisateurs)
        .values({
          id: userId,
          email: data.email,
          // The administrator's provisioning act is the e-mail attestation:
          // it is written here, by the service — never a toggle.
          emailVerified: true,
          googleAuthEnabled: data.googleAuthEnabled ?? false,
          nom: data.nom,
          prenom: data.prenom,
          poste: data.poste,
          role: data.role as
            | "EMPLOYEE"
            | "MANAGER"
            | "FINANCE_ADMIN"
            | "GENERAL_DIRECTION",
          societeId: societe.id,
          departementId: data.departementId,
          telephone: data.telephone || null,
          modifieLe: new Date(),
        })
        .returning()

      await setPassword(tx, user.id, password)

      await logAudit(
        {
          utilisateurId: actorId,
          action: "CREATION_UTILISATEUR",
          entite: "Utilisateur",
          entiteId: user.id,
          details: { email: user.email, role: user.role },
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
    const { motDePasse, email, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (email !== undefined) {
      updateData.email = email
    }

    return this._db.transaction(async (tx) => {
      const [cible] = await tx
        .select({ id: utilisateurs.id, role: utilisateurs.role })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, id))
        .limit(1)
      if (!cible) throw new UtilisateurNotFoundError()

      // Grant rules (#236): refuse cross-tier / self role grants before
      // writing anything.
      const [actor] = await tx
        .select({ id: utilisateurs.id, role: utilisateurs.role })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, actorId))
        .limit(1)
      assertGrantAdministration(actor, cible.role, data.role, id, actorId)

      const [user] = await tx
        .update(utilisateurs)
        .set(updateData)
        .where(eq(utilisateurs.id, id))
        .returning()

      if (!user) throw new UtilisateurNotFoundError()

      if (motDePasse) {
        await setPassword(tx, id, motDePasse)
      }

      await logAudit(
        {
          utilisateurId: actorId,
          action: "MODIFICATION_UTILISATEUR",
          entite: "Utilisateur",
          entiteId: user.id,
          details:
            data.role !== undefined && data.role !== cible.role
              ? { email: user.email, rolePrecedent: cible.role, role: user.role }
              : { email: user.email },
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
    const [utilisateur] = await this._db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, userId))
      .limit(1)
    if (!utilisateur) throw new UtilisateurNotFoundError()

    const isValid = await verifyCredential(this._db, userId, currentPassword)
    if (!isValid) throw new MotDePasseIncorrectError()

    await this._db.transaction(async (tx) => {
      await setPassword(tx, userId, newPassword)

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
      const isValid = await verifyCredential(this._db, userId, data.currentPassword)
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
