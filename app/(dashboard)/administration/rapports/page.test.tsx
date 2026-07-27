import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ETAPE_LABELS, formatCurrency } from "@/lib/constants"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/demande", () => ({
  countByEtape: vi.fn(),
  aggregateBudget: vi.fn(),
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

const ETAPE_COUNTS: Record<string, number> = {
  DRAFT: 2,
  MANAGER_REVIEW: 3,
  FINANCE_REVIEW: 1,
  DIRECTION_REVIEW: 0,
  FINAL: 5,
}

describe("Rapports page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("reads counts and budget through the queries port and renders them", async () => {
    const { auth } = await import("@/lib/auth")
    const { countByEtape: mockCountByEtape, aggregateBudget: mockAggregateBudget } = await import("@/lib/demande")

    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession())
    ;(mockCountByEtape as ReturnType<typeof vi.fn>).mockImplementation((etape: string) =>
      Promise.resolve(ETAPE_COUNTS[etape] ?? 0)
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    const element = await RapportsPage()
    const html = renderToStaticMarkup(element)

    const etapes = Object.keys(ETAPE_LABELS)
    expect(mockCountByEtape).toHaveBeenCalledTimes(etapes.length)
    etapes.forEach((s) => {
      expect(mockCountByEtape).toHaveBeenCalledWith(s)
    })

    expect(mockAggregateBudget).toHaveBeenCalledWith(["FINAL"])

    const total = Object.values(ETAPE_COUNTS).reduce((a, b) => a + b, 0)

    expect(html).toContain(String(total))
    expect(html).toContain(String(ETAPE_COUNTS["FINAL"]))
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
