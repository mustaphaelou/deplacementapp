import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { eq, count } from "drizzle-orm"
import { db } from "@/db"
import { societes } from "@/db/schema/societes"
import { departements } from "@/db/schema/departements"
import { utilisateurs } from "@/db/schema/utilisateurs"
import { validateRequest } from "@/lib/api-utils"
import { setupRegisterSchema } from "@/lib/schemas"
import { handleServiceError } from "@/lib/errors"

export async function POST(req: NextRequest) {
  try {
    const [societeCount] = await db.select({ value: count() }).from(societes)
    if ((societeCount?.value ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cette instance est déjà configurée." },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(setupRegisterSchema, body)
    if (!validation.ok) return validation.response
    const { societeNom, societeEmailDomain, departements: departementNames, admin } = validation.data

    if (!departementNames.includes(admin.departementNom)) {
      return NextResponse.json(
        { error: "Le département de l'administrateur doit faire partie des départements déclarés" },
        { status: 400 }
      )
    }

    const societeId = crypto.randomUUID()
    await db.insert(societes).values({
      id: societeId,
      nom: societeNom,
      domaineEmail: societeEmailDomain || null,
      modifieLe: new Date(),
    })

    const departementIds = new Map<string, string>()
    for (const nom of departementNames) {
      const deptId = crypto.randomUUID()
      await db.insert(departements).values({
        id: deptId,
        nom,
        societeId,
      })
      departementIds.set(nom, deptId)
    }

    const hashedPassword = await hash(admin.password, 12)
    const userId = crypto.randomUUID()

    await db.insert(utilisateurs).values({
      id: userId,
      email: admin.email,
      motDePasse: hashedPassword,
      nom: admin.nom,
      prenom: admin.prenom,
      poste: admin.poste,
      role: "GENERAL_DIRECTION" as const,
      actif: true,
      societeId,
      departementId: departementIds.get(admin.departementNom)!,
      modifieLe: new Date(),
    })

    return NextResponse.json({
      user: {
        id: userId,
        email: admin.email,
        prenom: admin.prenom,
        nom: admin.nom,
        role: "GENERAL_DIRECTION",
      },
    })
  } catch (e) {
    return handleServiceError(e)
  }
}