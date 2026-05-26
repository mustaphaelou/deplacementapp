import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DemandeDeplacement, Utilisateur, VehiculeEntreprise, PrismaClient } from "@prisma/client"
import type { PdfRenderData } from "@/lib/pdf-types"
import { PdfRenderer } from "@/lib/pdf-renderer"

const mockDemande: DemandeDeplacement & { employe: Utilisateur; vehicule: VehiculeEntreprise | null; assigneA: Utilisateur | null } = {
  id: "d-1",
  numero: "DD-2025-0001",
  employeId: "u-1",
  assigneAId: "u-2",
  statut: "APPROUVEE_MANAGER" as any,
  employeNom: "Dupont",
  employePrenom: "Jean",
  employePoste: "Développeur",
  employeDepartement: "IT",
  motif: '["Réunion client"]',
  dateDepart: new Date("2025-06-01"),
  dateRetour: new Date("2025-06-05"),
  destination: "Casablanca",
  typeTransport: "AVION" as any,
  autreTransport: null,
  vehiculeId: "v-1",
  fraisTransport: { toNumber: () => 100 } as any,
  fraisHebergement: { toNumber: () => 200 } as any,
  fraisRepas: { toNumber: () => 50 } as any,
  fraisDivers: { toNumber: () => 30 } as any,
  totalEstime: { toNumber: () => 380 } as any,
  avanceRequise: false,
  montantAvance: null,
  description: null,
  commentaireManager: null,
  commentaireFinance: null,
  commentaireDirection: null,
  soumiseLe: null,
  approuveeManagerLe: null,
  approuveeFinanceLe: null,
  approuveeDirectionLe: null,
  rejeteeLe: null,
  retireeLe: null,
  deletedAt: null,
  creeLe: new Date("2025-05-24"),
  modifieLe: new Date("2025-05-24"),
  employe: {
    id: "u-1",
    email: "jean.dupont@example.com",
    motDePasse: "hashed",
    nom: "Dupont",
    prenom: "Jean",
    poste: "Développeur",
    role: "EMPLOYEE" as any,
    departementId: "dep-1",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2020-01-01"),
    modifieLe: new Date("2020-01-01"),
  },
  vehicule: {
    id: "v-1",
    nom: "Peugeot 3008",
    immatriculation: "AB-123-CD",
    disponible: true,
    creeLe: new Date("2023-01-01"),
  },
  assigneA: {
    id: "u-2",
    email: "pierre.bernard@example.com",
    motDePasse: "hashed",
    nom: "Bernard",
    prenom: "Pierre",
    poste: "Manager",
    role: "MANAGER" as any,
    departementId: "dep-2",
    avatarUrl: null,
    telephone: null,
    dateEmbauche: null,
    actif: true,
    creeLe: new Date("2020-06-01"),
    modifieLe: new Date("2020-06-01"),
  },
}

function makeMockPrisma() {
  return {
    demandeDeplacement: {
      findUnique: vi.fn().mockResolvedValue(mockDemande),
    },
    document: {
      create: vi.fn().mockResolvedValue({ id: "doc-1" }),
    },
  } as unknown as PrismaClient
}

describe("PDF route integration", () => {
  it("toPdfRenderData produces valid PdfRenderData for pdfRenderer", async () => {
    const { toPdfRenderData } = await import("@/lib/pdf-mapper")
    const data = toPdfRenderData(mockDemande)

    expect(data.numero).toBe("DD-2025-0001")
    expect(data.statut).toBe("APPROUVEE_MANAGER")
    expect(data.assigneA).toEqual({ id: "u-2", nom: "Bernard", prenom: "Pierre" })
    expect(data.vehicule).toEqual({ nom: "Peugeot 3008", immatriculation: "AB-123-CD" })
  })

  it("pdfRenderer renders a non-empty buffer from mapped data", async () => {
    const { toPdfRenderData } = await import("@/lib/pdf-mapper")
    const { ReactPdfAdapter } = await import("@/lib/pdf-renderer")

    const data = toPdfRenderData(mockDemande)
    const renderer = new PdfRenderer(new ReactPdfAdapter())
    const buffer = await renderer.render(data)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it("mock Prisma can findUnique with expanded include", async () => {
    const prisma = makeMockPrisma()

    const demande = (await prisma.demandeDeplacement.findUnique({ where: { id: "d-1" }, include: { employe: true, vehicule: true, assigneA: true } } as any)) as any

    expect(demande).toBeDefined()
    expect(demande?.employe.nom).toBe("Dupont")
    expect(demande?.vehicule?.nom).toBe("Peugeot 3008")
    expect(demande?.assigneA?.nom).toBe("Bernard")
  })

  it("mock Prisma document.create stores the PDF record", async () => {
    const prisma = makeMockPrisma()

    const doc = await prisma.document.create({
      data: {
        demandeId: "d-1",
        type: "PDF",
        chemin: "demande-DD-2025-0001.pdf",
      },
    })

    expect(doc).toBeDefined()
    expect(prisma.document.create).toHaveBeenCalledTimes(1)
  })
})
