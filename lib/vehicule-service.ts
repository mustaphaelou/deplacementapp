import { eq, asc, desc } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { vehiculesEntreprise } from "../db/schema/vehicules-entreprise"
import { db } from "../db"
import { logAudit } from "./audit"
import { VehiculeNotFoundError } from "./errors"

export { VehiculeNotFoundError }

export class VehiculeService {
  constructor(private _db: DrizzleDb) {}

  async list() {
    return this._db.query.vehiculesEntreprise.findMany({
      orderBy: [asc(vehiculesEntreprise.nom)],
    })
  }

  async create(
    data: { nom: string; immatriculation: string; disponible?: boolean },
    actorId: string
  ) {
    const [vehicule] = await this._db
      .insert(vehiculesEntreprise)
      .values({
        id: crypto.randomUUID(),
        ...data,
        disponible: data.disponible ?? true,
      })
      .returning()

    await logAudit(
      {
        utilisateurId: actorId,
        action: "CREATION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: vehicule.id,
        details: { nom: vehicule.nom },
      },
      this._db
    )

    return vehicule
  }

  async update(
    id: string,
    data: { nom?: string; immatriculation?: string; disponible?: boolean },
    actorId: string
  ) {
    const [vehicule] = await this._db
      .update(vehiculesEntreprise)
      .set(data)
      .where(eq(vehiculesEntreprise.id, id))
      .returning()

    if (!vehicule) throw new VehiculeNotFoundError()

    await logAudit(
      {
        utilisateurId: actorId,
        action: "MODIFICATION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: vehicule.id,
        details: { nom: vehicule.nom },
      },
      this._db
    )

    return vehicule
  }

  async delete(id: string, actorId: string): Promise<void> {
    const [vehicule] = await this._db
      .delete(vehiculesEntreprise)
      .where(eq(vehiculesEntreprise.id, id))
      .returning()

    if (!vehicule) throw new VehiculeNotFoundError()

    await logAudit(
      {
        utilisateurId: actorId,
        action: "SUPPRESSION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: id,
      },
      this._db
    )
  }
}

export const vehiculeService = new VehiculeService(db)
