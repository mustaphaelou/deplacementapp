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
    const id = crypto.randomUUID()

    return this._db.transaction(async (tx) => {
      const [vehicule] = await tx
        .insert(vehiculesEntreprise)
        .values({
          id,
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
        tx as any
      )

      return vehicule
    })
  }

  async update(
    id: string,
    data: { nom?: string; immatriculation?: string; disponible?: boolean },
    actorId: string
  ) {
    return this._db.transaction(async (tx) => {
      const [vehicule] = await tx
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
        tx as any
      )

      return vehicule
    })
  }

  async delete(id: string, actorId: string): Promise<void> {
    await this._db.transaction(async (tx) => {
      const [vehicule] = await tx
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
        tx as any
      )
    })
  }
}

export const vehiculeService = new VehiculeService(db)
