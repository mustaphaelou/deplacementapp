import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    societe: { count: vi.fn(), create: vi.fn() },
    utilisateur: { count: vi.fn(), create: vi.fn() },
    departement: { upsert: vi.fn() },
  },
}))

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed$"),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

function mockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/setup/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

const validPayload = {
  societeNom: "Ma Société",
  departements: ["Direction Générale", "Technique"],
  admin: {
    email: "admin@exemple.ma",
    password: "motdepasse123",
    nom: "Alaoui",
    prenom: "Sara",
    poste: "Directrice Générale",
    departementNom: "Direction Générale",
  },
}

async function mockNoUsers() {
  const { prisma } = await import("@/lib/prisma")
  ;(prisma.societe.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
  return prisma
}

async function mockSuccessfulWrites() {
  const prisma = await mockNoUsers()
  ;(prisma.societe.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "default",
    nom: "Ma Société",
  })
  ;(prisma.departement.upsert as ReturnType<typeof vi.fn>).mockImplementation(
    (args: { where: { nom_societeId: { nom: string } } }) =>
      Promise.resolve({ id: `id-${args.where.nom_societeId.nom}`, nom: args.where.nom_societeId.nom })
  )
  ;(prisma.utilisateur.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "u-1",
    email: "admin@exemple.ma",
    prenom: "Sara",
    nom: "Alaoui",
    role: "GENERAL_DIRECTION",
  })
  return prisma
}

describe("setup register route", () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    const { hash } = await import("bcryptjs")
    ;(hash as ReturnType<typeof vi.fn>).mockResolvedValue("$hashed$")
  })

  it("POST returns 409 when a Societe already exists", async () => {
    const { prisma } = await import("@/lib/prisma")
    ;(prisma.societe.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Cette instance est déjà configurée.")
    expect(prisma.societe.create).not.toHaveBeenCalled()
    expect(prisma.departement.upsert).not.toHaveBeenCalled()
    expect(prisma.utilisateur.create).not.toHaveBeenCalled()
  })

  it("POST returns 400 on invalid email", async () => {
    await mockNoUsers()

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        admin: { ...validPayload.admin, email: "pas-un-email" },
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST returns 400 on empty societeNom", async () => {
    await mockNoUsers()

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        societeNom: "",
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST creates Societe, departments and the first Utilisateur on valid input", async () => {
    const prisma = await mockSuccessfulWrites()
    const { hash } = await import("bcryptjs")

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      user: {
        id: "u-1",
        email: "admin@exemple.ma",
        prenom: "Sara",
        nom: "Alaoui",
        role: "GENERAL_DIRECTION",
      },
    })
    expect(hash).toHaveBeenCalledWith("motdepasse123", 12)
    expect(prisma.societe.create).toHaveBeenCalledWith({
      data: { nom: "Ma Société", domaineEmail: null },
    })
    expect(prisma.utilisateur.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "admin@exemple.ma",
        motDePasse: "$hashed$",
        nom: "Alaoui",
        prenom: "Sara",
        poste: "Directrice Générale",
        role: "GENERAL_DIRECTION",
        actif: true,
        societeId: "default",
        departementId: "id-Direction Générale",
      }),
    })
  })

  it("POST upserts each department by nom and societeId", async () => {
    const prisma = await mockSuccessfulWrites()

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    expect(prisma.departement.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.departement.upsert).toHaveBeenCalledWith({
      where: { nom_societeId: { nom: "Direction Générale", societeId: "default" } },
      update: {},
      create: { nom: "Direction Générale", societeId: "default" },
    })
    expect(prisma.departement.upsert).toHaveBeenCalledWith({
      where: { nom_societeId: { nom: "Technique", societeId: "default" } },
      update: {},
      create: { nom: "Technique", societeId: "default" },
    })
  })
})