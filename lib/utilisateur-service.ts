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
} from "./errors"

// What the profile read actually selects: the Utilisateur and their
// Departement. It deliberately carries no demand count — the « Demandes »
// stat is a DemandeDeplacement fact, so it is counted by the demande read
// model (`countDemandes`) and asked for at the page, not here. #288 removed
// the `_count: { demandes }` this interface used to promise.
//
// The blanket `as unknown as ProfileResult` that used to sit on this return
// existed for the fabricated `_count` alone. That is measured, not assumed:
// with `_count` still on the return value, deleting the assertion typechecks
// clean; with `_count` gone from both the type and the value, nothing is left
// to reconcile. So no narrowing was needed, the assertion was deleted rather
// than replaced, and no explicit-and-local narrowing comment is owed here.
//
// Known, deliberately not fixed here, and recorded by the spec rather than
// promised by this comment: the shape still mirrors a persistence row — a
// subset of the utilisateurs table carrying departementId/societeId/actif/
// modifieLe and friends the profile page never presents. Tightening it to
// exactly what a profile shows is future work (#287, Further Notes).
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
}

export {
  UtilisateurNotFoundError,
  MotDePasseIncorrectError,
  EmailChangeRequiresPasswordError,
  NoProfileUpdateDataError,
  AvatarError,
}

const DEFAULT_PASSWORD = "password123"

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
    // The selection IS the declared shape — no reshaping, so no spread that
    // only reads as if it narrowed one, and no assertion to reconcile it.
    return user
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
    const { motDePasse, email, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (email !== undefined) {
      updateData.email = email
    }

    return this._db.transaction(async (tx) => {
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

/**
 * One reader owns the rule that a Utilisateur may act: the `actif` column, and
 * nothing else. It is deliberately NOT a method on {@link UtilisateurService} —
 * that class binds its handle at construction and the module's exported
 * instance is built at module load, so a method there would have captured the
 * handle before any test could substitute it. A module-level function whose
 * handle argument defaults to this module's own `db` is redirected by exactly
 * that substitution; #314's test does it against a real in-process Postgres.
 *
 * An identifier matching no Utilisateur reads `false` rather than throwing:
 * the question asked is « may this one act », and a Utilisateur that does not
 * exist may not. This preserves the behaviour of the private copy in
 * `lib/auth/session.ts` (`row?.actif ?? false`), which #316 will retire in
 * favour of a call to here.
 */
export async function peutAgir(
  utilisateurId: string,
  handle: DrizzleDb = db
): Promise<boolean> {
  const [row] = await handle
    .select({ actif: utilisateurs.actif })
    .from(utilisateurs)
    .where(eq(utilisateurs.id, utilisateurId))
    .limit(1)
  return row?.actif ?? false
}

export const utilisateurService = new UtilisateurService(db)
