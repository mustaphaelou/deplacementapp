import type { PrismaClient, VehiculeEntreprise } from "@prisma/client"
import { prisma } from "./prisma"
import { auditBus } from "./audit-bus"

export class VehiculeNotFoundError extends Error {
  status = 404
  constructor() {
    super("Vehicule introuvable")
    this.name = "VehiculeNotFoundError"
  }
}

export class VehiculeService {
  constructor(
    private db: PrismaClient,
    private audit = auditBus
  ) {}

  async list(): Promise<VehiculeEntreprise[]> {
    return this.db.vehiculeEntreprise.findMany({
      orderBy: { nom: "asc" },
    })
  }

  async create(
    data: { nom: string; immatriculation: string; disponible?: boolean },
    actorId: string
  ): Promise<VehiculeEntreprise> {
    const vehicule = await this.db.vehiculeEntreprise.create({
      data: {
        nom: data.nom,
        immatriculation: data.immatriculation,
        disponible: data.disponible ?? true,
      },
    })

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
  ): Promise<VehiculeEntreprise> {
    try {
      const vehicule = await this.db.vehiculeEntreprise.update({
        where: { id },
        data,
      })

      await this.audit.log({
        utilisateurId: actorId,
        action: "MODIFICATION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: vehicule.id,
        details: { nom: vehicule.nom },
      })

      return vehicule
    } catch {
      throw new VehiculeNotFoundError()
    }
  }

  async delete(id: string, actorId: string): Promise<void> {
    try {
      await this.db.vehiculeEntreprise.delete({ where: { id } })

      await this.audit.log({
        utilisateurId: actorId,
        action: "SUPPRESSION_VEHICULE",
        entite: "VehiculeEntreprise",
        entiteId: id,
      })
    } catch {
      throw new VehiculeNotFoundError()
    }
  }
}

export const vehiculeService = new VehiculeService(prisma)
