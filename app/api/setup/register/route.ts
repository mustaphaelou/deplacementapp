import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { validateRequest } from "@/lib/api-utils"
import { setupRegisterSchema } from "@/lib/schemas"
import { handleServiceError } from "@/lib/errors"

export async function POST(req: NextRequest) {
  try {
    const societeCount = await prisma.societe.count()
    if (societeCount > 0) {
      return NextResponse.json(
        { error: "Cette instance est déjà configurée." },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(setupRegisterSchema, body)
    if (!validation.ok) return validation.response
    const { societeNom, societeEmailDomain, departements, admin } = validation.data

    if (!departements.includes(admin.departementNom)) {
      return NextResponse.json(
        { error: "Le département de l'administrateur doit faire partie des départements déclarés" },
        { status: 400 }
      )
    }

    const societe = await prisma.societe.create({
      data: {
        nom: societeNom,
        domaineEmail: societeEmailDomain || null,
      },
    })

    const departementIds = new Map<string, string>()
    for (const nom of departements) {
      const departement = await prisma.departement.upsert({
        where: { nom_societeId: { nom, societeId: societe.id } },
        update: {},
        create: { nom, societeId: societe.id },
      })
      departementIds.set(nom, departement.id)
    }

    const hashedPassword = await hash(admin.password, 12)

    const user = await prisma.utilisateur.create({
      data: {
        email: admin.email,
        motDePasse: hashedPassword,
        nom: admin.nom,
        prenom: admin.prenom,
        poste: admin.poste,
        role: "GENERAL_DIRECTION",
        actif: true,
        societeId: societe.id,
        departementId: departementIds.get(admin.departementNom)!,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
      },
    })
  } catch (e) {
    return handleServiceError(e)
  }
}