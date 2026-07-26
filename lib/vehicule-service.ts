import { eq, asc, desc } from "drizzle-orm"
import type { DrizzleDb } from "../db"
import { vehiculesEntreprise } from "../db/schema/vehicules-entreprise"
import { db } from "../db"
import { auditBus } from "./audit-bus"
import { VehiculeNotFoundError } from "./errors"

export { VehiculeNotFoundError }

export class VehiculeService {
  constructor(
    private _db: DrizzleDb,
    private audit = auditBus
  ) {}

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
      .values({ id: crypto.randomUUID(), ...data, disponible: data.disponible ?? true })
      .returning()

    await this.audit.log({
      utilisateurId: actorId,
      action: "CREATION_VEHICULE",
      entite: "VehiculeEntreprise",
      entiteId: vehicule.id,
      details: { nom: vehicule.nom },
    })

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

    await this.audit.log({
      utilisateurId: actorId,
      action: "MODIFICATION_VEHICULE",
      entite: "VehiculeEntreprise",
      entiteId: vehicule.id,
      details: { nom: vehicule.nom },
    })

    return vehicule
  }

  async delete(id: string, actorId: string): Promise<void> {
    const [vehicule] = await this._db
      .delete(vehiculesEntreprise)
      .where(eq(vehiculesEntreprise.id, id))
      .returning()

    if (!vehicule) throw new VehiculeNotFoundError()

    await this.audit.log({
      utilisateurId: actorId,
      action: "SUPPRESSION_VEHICULE",
      entite: "VehiculeEntreprise",
      entiteId: id,
    })
  }
}

export const vehiculeService = new VehiculeService(db)