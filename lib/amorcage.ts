import { hash } from "bcryptjs"
import { count } from "drizzle-orm"
import type { PgDatabase } from "drizzle-orm/pg-core"
import { db } from "../db"
import { societes } from "../db/schema/societes"
import { departements } from "../db/schema/departements"
import { utilisateurs } from "../db/schema/utilisateurs"
import { AmorcageDejaConfigureError } from "./errors"
import { clearSocieteCache } from "@/lib/societe"

async function countSocietes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx: PgDatabase<any, any, any>,
): Promise<number> {
  const [result] = await dbOrTx
    .select({ value: count() })
    .from(societes)
  return result?.value ?? 0
}

export async function estEnAmorcage(): Promise<boolean> {
  const n = await countSocietes(db)
  return n === 0
}

export async function quitterAmorcage(input: {
  societe: { nom: string; nomExpediteurEmail: string; domaineEmail: string }
  departements: string[]
  admin: {
    email: string
    password: string
    nom: string
    prenom: string
    poste: string
    departementNom: string
  }
}): Promise<{
  user: { id: string; email: string; prenom: string; nom: string; role: string }
}> {
  const hashedPassword = await hash(input.admin.password, 12)

  const result = await db.transaction(async (tx) => {
    const existingCount = await countSocietes(tx)
    if (existingCount > 0) {
      throw new AmorcageDejaConfigureError()
    }

    const societeId = crypto.randomUUID()
    await tx.insert(societes).values({
      id: societeId,
      nom: input.societe.nom,
      nomExpediteurEmail: input.societe.nomExpediteurEmail,
      domaineEmail: input.societe.domaineEmail,
      modifieLe: new Date(),
    })

    const departementIds = new Map<string, string>()
    for (const nom of input.departements) {
      const deptId = crypto.randomUUID()
      await tx.insert(departements).values({
        id: deptId,
        nom,
        societeId,
      })
      departementIds.set(nom, deptId)
    }

    const userId = crypto.randomUUID()
    await tx.insert(utilisateurs).values({
      id: userId,
      email: input.admin.email,
      motDePasse: hashedPassword,
      nom: input.admin.nom,
      prenom: input.admin.prenom,
      poste: input.admin.poste,
      role: "GENERAL_DIRECTION",
      departementId: departementIds.get(input.admin.departementNom)!,
      societeId,
      actif: true,
      modifieLe: new Date(),
    })

    return {
      user: {
        id: userId,
        email: input.admin.email,
        prenom: input.admin.prenom,
        nom: input.admin.nom,
        role: "GENERAL_DIRECTION",
      },
    }
  })

  clearSocieteCache()
  return result
}
