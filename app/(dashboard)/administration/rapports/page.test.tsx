import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { STATUT_LABELS, formatCurrency } from "@/lib/constants"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/demande/di", () => ({
  demandeService: {
    queries: {
      countByStatut: vi.fn(),
      aggregateBudget: vi.fn(),
    },
  },
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
}))

function mockSession(role = "FINANCE_ADMIN") {
  return {
    user: {
      id: "u-1",
      email: "user@example.com",
      name: "User",
      role,
      departementId: "d-1",
      departement: "IT",
      poste: "Dev",
    },
  }
}

const STATUT_COUNTS: Record<string, number> = {
  BROUILLON: 2,
  SOUMISE: 3,
  APPROUVEE_MANAGER: 1,
  APPROUVEE_FINANCE: 0,
  APPROUVEE: 5,
  REJETEE_MANAGER: 1,
  REJETEE_FINANCE: 2,
  REJETEE_DIRECTION: 0,
  RETIREE: 1,
}

describe("Rapports page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("reads counts and budget through the queries port and renders them", async () => {
    const { auth } = await import("@/lib/auth")
    const { demandeService } = await import("@/lib/demande/di")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession())
    ;(demandeService.queries.countByStatut as ReturnType<typeof vi.fn>).mockImplementation((statut: string) =>
      Promise.resolve(STATUT_COUNTS[statut] ?? 0)
    )
    ;(demandeService.queries.aggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    const element = await RapportsPage()
    const html = renderToStaticMarkup(element)

    const statuts = Object.keys(STATUT_LABELS)
    expect(demandeService.queries.countByStatut).toHaveBeenCalledTimes(statuts.length)
    statuts.forEach((s) => {
      expect(demandeService.queries.countByStatut).toHaveBeenCalledWith(s)
    })

    expect(demandeService.queries.aggregateBudget).toHaveBeenCalledWith([
      "APPROUVEE",
      "APPROUVEE_FINANCE",
      "APPROUVEE_MANAGER",
    ])

    const total = Object.values(STATUT_COUNTS).reduce((a, b) => a + b, 0)
    const totalRejetees =
      STATUT_COUNTS["REJETEE_MANAGER"] + STATUT_COUNTS["REJETEE_FINANCE"] + STATUT_COUNTS["REJETEE_DIRECTION"]

    expect(html).toContain(String(total))
    expect(html).toContain(String(STATUT_COUNTS["APPROUVEE"]))
    expect(html).toContain(String(totalRejetees))
    expect(html).toContain(formatCurrency(45000))
  })

  it("redirects when role is not authorised", async () => {
    const { auth } = await import("@/lib/auth")
    const { redirect } = await import("next/navigation")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession("EMPLOYEE"))

    const { default: RapportsPage } = await import("./page")
    await expect(RapportsPage()).rejects.toThrow("NEXT_REDIRECT: /")

    expect(redirect).toHaveBeenCalledWith("/")
  })

  it("redirects when not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    const { redirect } = await import("next/navigation")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: RapportsPage } = await import("./page")
    await expect(RapportsPage()).rejects.toThrow("NEXT_REDIRECT: /")

    expect(redirect).toHaveBeenCalledWith("/")
  })
})
