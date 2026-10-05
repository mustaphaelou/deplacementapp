import { eq, and, asc } from "drizzle-orm"
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
import type { Role } from "./auth/roles"
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
      // The Role union, not `string`. The parameter was `string` and the write
      // carried an inline `as` naming the union across four lines to pull it
      // back down — a cast `lib/auth/role-casts.test.ts` cannot see, because
      // its regex matches the SPELLED `as Role` and this one spelled the union
      // out inline instead of naming it. Typing the parameter as the union
      // deletes the cast rather than widening the pin: the route validates with
      // `utilisateurSchema` (a `z.enum` over `TOUS_LES_ROLES`), so `data.role`
      // arrives already narrowed and the laundering has nowhere to happen.
      role: Role
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
          // No cast: the parameter is the union, so the value the route
          // validated is the type the column declares.
          role: data.role,
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
 * The rule that a Utilisateur may act, in the one shape a SQL fragment can
 * have: « the `actif` column reads true », and nothing else.
 *
 * This is the reader's SECOND shape, added in #315. A caller that filters a
 * SET of Utilisateurs — the Notification recipient resolver — cannot ask
 * {@link peutAgir} once per candidate without turning one query into many, so
 * it needs the rule as something it can compose into its own `WHERE`. This
 * export is that something: the resolver imports it instead of writing
 * `eq(utilisateurs.actif, true)` a second time.
 *
 * It is a Drizzle `SQL` fragment built from the schema table, so this module
 * stays what it already was — a server module that imports `db` and the
 * schema at runtime. Nothing new reaches a client bundle through it, and
 * `google-refusals.ts` (the login page's own vocabulary) deliberately does NOT
 * import this module.
 */
export const conditionActif = eq(utilisateurs.actif, true)

/**
 * The same rule asked about ONE Utilisateur, derived from
 * {@link conditionActif} rather than restated: the query below is « is there a
 * Utilisateur with this identifier that the activity condition admits? ».
 *
 * That derivation is the point. If `peutAgir` and the condition could be
 * written independently, a future change to one would leave the other
 * answering a different question — two spellings of one rule, which is the
 * defect #313 exists to remove. Because the per-Utilisateur answer is the set
 * condition applied to a single id, they cannot disagree: a Utilisateur the
 * condition admits is exactly one `peutAgir` answers true for. The suite pins
 * that equivalence against a real in-process Postgres.
 *
 * Deliberately NOT a method on {@link UtilisateurService}: that class binds
 * its handle at construction and the module's exported instance is built at
 * module load, so a method there would have captured the handle before any
 * test could substitute it. A module-level function whose handle argument
 * defaults to this module's own `db` is redirected by exactly that
 * substitution; #314's test does it against a real in-process Postgres.
 *
 * An identifier matching no Utilisateur reads `false` rather than throwing:
 * the question asked is « may this one act », and a Utilisateur that does not
 * exist may not. This preserves the behaviour of the private copy that
 * `lib/auth/session.ts` used to keep (`row?.actif ?? false`); #316 retired that
 * copy in favour of a call to here, so the three former copies of this rule
 * are now one.
 */
export async function peutAgir(
  utilisateurId: string,
  handle: DrizzleDb = db
): Promise<boolean> {
  const [row] = await handle
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.id, utilisateurId), conditionActif))
    .limit(1)
  return row !== undefined
}

export const utilisateurService = new UtilisateurService(db)
