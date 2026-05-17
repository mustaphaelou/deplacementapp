import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ajouterAudit } from "@/lib/audit"
import { notificationBus } from "@/lib/notification-bus"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const statut = searchParams.get("statut") || undefined
  const recherche = searchParams.get("recherche") || undefined

  const role = session.user.role
  const userId = session.user.id

  const where: any = { deletedAt: null }

  if (role === "EMPLOYEE") {
    where.employeId = userId
  }

  if (statut) {
    where.statut = statut
  }

  if (recherche) {
    where.OR = [
      { destination: { contains: recherche, mode: "insensitive" } },
      { numero: { contains: recherche, mode: "insensitive" } },
    ]
  }

  const [demandes, total] = await Promise.all([
    prisma.demandeDeplacement.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        employe: { select: { id: true, prenom: true, nom: true } },
      },
    }),
    prisma.demandeDeplacement.count({ where }),
  ])

  return NextResponse.json({ demandes, total })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await req.json()
  const { action, ...data } = body

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    include: { departement: true },
  })
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

  const nextNum = (await prisma.demandeDeplacement.count()) + 1
  const numero = `DD-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`

  const motifArray = data.motif || []
  if (motifArray.includes("autre") && data.motifAutre) {
    const idx = motifArray.indexOf("autre")
    motifArray[idx] = `Autre: ${data.motifAutre}`
  }

  const demande = await prisma.demandeDeplacement.create({
    data: {
      numero,
      employeId: user.id,
      statut: action === "submit" ? "SOUMISE" : "BROUILLON",
      employeNom: user.nom,
      employePrenom: user.prenom,
      employePoste: user.poste,
      employeDepartement: user.departement.nom,
      motif: JSON.stringify(motifArray),
      dateDepart: new Date(data.dateDepart),
      dateRetour: new Date(data.dateRetour),
      destination: data.destination,
      typeTransport: data.typeTransport,
      autreTransport: data.autreTransport || null,
      vehiculeId: data.vehiculeId || null,
      fraisTransport: parseFloat(data.fraisTransport || "0"),
      fraisHebergement: parseFloat(data.fraisHebergement || "0"),
      fraisRepas: parseFloat(data.fraisRepas || "0"),
      fraisDivers: parseFloat(data.fraisDivers || "0"),
      totalEstime:
        parseFloat(data.fraisTransport || "0") +
        parseFloat(data.fraisHebergement || "0") +
        parseFloat(data.fraisRepas || "0") +
        parseFloat(data.fraisDivers || "0"),
      avanceRequise: data.avanceRequise || false,
      montantAvance: data.avanceRequise ? parseFloat(data.montantAvance || "0") : null,
      description: data.description || null,
      soumiseLe: action === "submit" ? new Date() : null,
    },
  })

  await ajouterAudit(user.id, action === "submit" ? "SOUMISSION" : "CREATION", "DemandeDeplacement", demande.id, { numero })

  if (action === "submit") {
    await notificationBus.dispatch("DEMANDE_SOUMISE", {
      demandeId: demande.id,
      numero: demande.numero,
      employe: { id: user.id, prenom: user.prenom, nom: user.nom },
    })
  }

  return NextResponse.json({ demande })
}
