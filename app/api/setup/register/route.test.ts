import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    utilisateur: { count: vi.fn(), create: vi.fn() },
    departement: { upsert: vi.fn() },
  },
}))

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed$"),
}))

// The route only uses validateRequest from api-utils, but that module also
// imports auth-utils -> auth -> next-auth, which cannot load under vitest.
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
  departements: ["Direction Générale", "Technique"],
  admin: {
    email: "admin@hay2010.ma",
    password: "motdepasse123",
    nom: "Alaoui",
    prenom: "Sara",
    poste: "Directrice Générale",
    departementNom: "Direction Générale",
  },
}

async function mockNoUsers() {
  const { prisma } = await import("@/lib/prisma")
  ;(prisma.utilisateur.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
  return prisma
}

async function mockSuccessfulWrites() {
  const prisma = await mockNoUsers()
  ;(prisma.departement.upsert as ReturnType<typeof vi.fn>).mockImplementation(
    (args: { where: { nom: string } }) =>
      Promise.resolve({ id: `id-${args.where.nom}`, nom: args.where.nom })
  )
  ;(prisma.utilisateur.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "u-1",
    email: "admin@hay2010.ma",
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

  it("POST returns 409 and writes nothing when Utilisateurs already exist", async () => {
    const { prisma } = await import("@/lib/prisma")
    const { hash } = await import("bcryptjs")
    ;(prisma.utilisateur.count as ReturnType<typeof vi.fn>).mockResolvedValue(2)

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Cette instance est déjà configurée.")
    expect(prisma.departement.upsert).not.toHaveBeenCalled()
    expect(prisma.utilisateur.create).not.toHaveBeenCalled()
    expect(hash).not.toHaveBeenCalled()
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

  it("POST returns 400 on password shorter than 8 characters", async () => {
    await mockNoUsers()

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        admin: { ...validPayload.admin, password: "court12" },
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST returns 400 on missing required fields", async () => {
    await mockNoUsers()

    const { POST } = await import("./route")
    const adminSansNom = {
      email: "admin@hay2010.ma",
      password: "motdepasse123",
      prenom: "Sara",
      poste: "Directrice Générale",
      departementNom: "Direction Générale",
    }
    const response = await POST(
      mockRequest({ ...validPayload, admin: adminSansNom })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST returns 400 when the admin departementNom is not in the submitted list", async () => {
    const prisma = await mockNoUsers()

    const { POST } = await import("./route")
    const response = await POST(
      mockRequest({
        ...validPayload,
        admin: { ...validPayload.admin, departementNom: "Inexistant" },
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
    expect(prisma.departement.upsert).not.toHaveBeenCalled()
    expect(prisma.utilisateur.create).not.toHaveBeenCalled()
  })

  it("POST returns 400 when the departements array is empty", async () => {
    await mockNoUsers()

    const { POST } = await import("./route")
    const response = await POST(mockRequest({ ...validPayload, departements: [] }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it("POST creates departments and the first Utilisateur on valid input", async () => {
    const prisma = await mockSuccessfulWrites()
    const { hash } = await import("bcryptjs")

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      user: {
        id: "u-1",
        email: "admin@hay2010.ma",
        prenom: "Sara",
        nom: "Alaoui",
        role: "GENERAL_DIRECTION",
      },
    })
    expect(hash).toHaveBeenCalledWith("motdepasse123", 12)
    expect(prisma.utilisateur.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "admin@hay2010.ma",
        motDePasse: "$hashed$",
        nom: "Alaoui",
        prenom: "Sara",
        poste: "Directrice Générale",
        role: "GENERAL_DIRECTION",
        actif: true,
        departementId: "id-Direction Générale",
      }),
    })
  })

  it("POST upserts each department by nom instead of creating duplicates", async () => {
    const prisma = await mockSuccessfulWrites()

    const { POST } = await import("./route")
    const response = await POST(mockRequest(validPayload))

    expect(response.status).toBe(200)
    expect(prisma.departement.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.departement.upsert).toHaveBeenCalledWith({
      where: { nom: "Direction Générale" },
      update: {},
      create: { nom: "Direction Générale" },
    })
    expect(prisma.departement.upsert).toHaveBeenCalledWith({
      where: { nom: "Technique" },
      update: {},
      create: { nom: "Technique" },
    })
  })
})
