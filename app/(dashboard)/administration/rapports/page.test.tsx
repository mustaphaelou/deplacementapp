import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { formatCurrency } from "@/lib/constants"
import { PIPELINE } from "@/lib/workflow"
import { ETAPE_LABELS } from "@/lib/demande-presentation"

const { mockHasAnyRole } = vi.hoisted(() => ({
  mockHasAnyRole: (role: string, allowed: readonly string[]) =>
    allowed.includes(role),
}))

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: vi.fn(),
  hasAnyRole: mockHasAnyRole,
}))

vi.mock("@/lib/demande", () => ({
  countDemandes: vi.fn(),
  aggregateBudget: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
}))

function mockUser(role = "FINANCE_ADMIN") {
  return {
    id: "u-1",
    email: "user@example.com",
    name: "User",
    role,
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

const ETAPE_COUNTS: Record<string, number> = {
  DRAFT: 2,
  MANAGER_REVIEW: 3,
  FINANCE_REVIEW: 1,
  DIRECTION_REVIEW: 0,
  FINAL: 5,
}

// Distinct from every stage count and from the derived totals, so the
// « Rejetées » pin cannot match another card's value.
const REJECTED_COUNT = 7

function resolveCount({
  etape,
  decision,
}: {
  etape?: string
  decision?: string
}) {
  return Promise.resolve(
    decision === "REJECTED" ? REJECTED_COUNT : (ETAPE_COUNTS[etape ?? ""] ?? 0)
  )
}

describe("Rapports page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("reads counts and budget through the queries port and renders them", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const {
      countDemandes: mockCountDemandes,
      aggregateBudget: mockAggregateBudget,
    } = await import("@/lib/demande")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockCountDemandes as ReturnType<typeof vi.fn>).mockImplementation(
      resolveCount
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    const element = await RapportsPage()
    const html = renderToStaticMarkup(element)

    const etapes = PIPELINE.map((stage) => stage.id)
    expect(mockCountDemandes).toHaveBeenCalledTimes(etapes.length + 1)
    // The stages are queried in pipeline order, stage by stage,
    etapes.forEach((s, i) => {
      expect(mockCountDemandes).toHaveBeenNthCalledWith(i + 1, { etape: s })
    })
    // then the « Rejetées » card reads the computed REJECTED count.
    expect(mockCountDemandes).toHaveBeenNthCalledWith(etapes.length + 1, {
      decision: "REJECTED",
    })

    expect(mockAggregateBudget).toHaveBeenCalledWith(["FINAL"])

    const total = Object.values(ETAPE_COUNTS).reduce((a, b) => a + b, 0)

    expect(html).toContain(String(total))
    expect(html).toContain(String(ETAPE_COUNTS["FINAL"]))
    expect(html).toContain(formatCurrency(45000))
    expect(html).toContain(`>${REJECTED_COUNT}</p>`)
  })

  it("renders the stage rows in PIPELINE order, not label-map insertion order", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const {
      countDemandes: mockCountDemandes,
      aggregateBudget: mockAggregateBudget,
    } = await import("@/lib/demande")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockCountDemandes as ReturnType<typeof vi.fn>).mockImplementation(
      resolveCount
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    const html = renderToStaticMarkup(await RapportsPage())

    const pipelineOrder = PIPELINE.map((stage) => ETAPE_LABELS[stage.id])
    expect(pipelineOrder).toEqual([
      "Brouillon",
      "En attente (Manager)",
      "En attente (Finance)",
      "En attente (Direction)",
      "Finalisé",
    ])

    let previousIndex = -1
    for (const label of pipelineOrder) {
      const index = html.indexOf(label)
      expect(index).toBeGreaterThan(previousIndex)
      previousIndex = index
    }
  })

  it("renders the prototype header anatomy and home treatment: breadcrumb, ghost CSV action, borderless stat cards, hairline-ruled steps", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const {
      countDemandes: mockCountDemandes,
      aggregateBudget: mockAggregateBudget,
    } = await import("@/lib/demande")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockCountDemandes as ReturnType<typeof vi.fn>).mockImplementation(
      resolveCount
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    const html = renderToStaticMarkup(await RapportsPage())

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("CSV")
    expect(html).toContain('href="/api/csv"')
    expect(html).toContain('data-slot="tooltip-trigger"')
    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("Total demandes")
    expect(html).toContain("Approuvées")
    expect(html).toContain("Rejetées")
    expect(html).toContain("Budget total")
    expect(html).toContain("Répartition par étape")
    expect(html).toContain("border-y border-border")
    expect(html).toContain("tabular-nums")
  })

  it("redirects when role is not authorised", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { redirect } = await import("next/navigation")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser("EMPLOYEE")
    )

    const { default: RapportsPage } = await import("./page")
    await expect(RapportsPage()).rejects.toThrow("NEXT_REDIRECT: /")

    expect(redirect).toHaveBeenCalledWith("/")
  })

  it("redirects when not authenticated", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { redirect } = await import("next/navigation")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: RapportsPage } = await import("./page")
    await expect(RapportsPage()).rejects.toThrow("NEXT_REDIRECT: /")

    expect(redirect).toHaveBeenCalledWith("/")
  })
})

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Rapports page — the #258 responsive page header", () => {
  const header = async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const {
      countDemandes: mockCountDemandes,
      aggregateBudget: mockAggregateBudget,
    } = await import("@/lib/demande")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
    ;(mockCountDemandes as ReturnType<typeof vi.fn>).mockImplementation(
      resolveCount
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)

    const { default: RapportsPage } = await import("./page")
    return renderToStaticMarkup(await RapportsPage())
  }

  it("scales the title 24px below md: and 40px from md: up", async () => {
    expect(await header()).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    expect(block).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
    // md: is the single shell breakpoint — no other variant may creep in.
    expect(block).not.toContain("sm:text-[")
    expect(block).not.toContain("lg:text-[")
    expect(block).not.toMatch(/(?:sm|lg):size-\d/)
  })

  it("truncates the breadcrumb to one line instead of wrapping it", async () => {
    const html = await header()
    const crumbs = html.slice(
      html.indexOf('aria-label="breadcrumb"'),
      html.indexOf('<div class="mt-6 flex items-center gap-4">')
    )

    // flex-nowrap on the list — twMerge drops the primitive's flex-wrap, so
    // `flex-nowrap` lands last and `flex-wrap` is gone from the output.
    expect(crumbs).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(crumbs).not.toContain("flex-wrap")
    // min-w-0 on the nav and the last item: a flex item's default min-width:auto
    // refuses to shrink below its content, so without these the ellipsis can
    // never engage.
    expect(crumbs).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(crumbs).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
    // truncate on the page itself, which is what renders the ellipsis.
    expect(crumbs).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("keeps the desktop anatomy and the CSV action exactly where they were", async () => {
    const html = await header()
    const start = html.indexOf('<div class="mt-6 flex items-center gap-4">')
    const block = html.slice(start, html.indexOf("</p>", start))

    // Untouched by #258: the mt-6 rhythm, the icon, and the top-right ghost
    // action with its label.
    expect(block).toContain('class="mt-6 flex items-center gap-4"')
    expect(block).toContain("size-6 text-primary")
    expect(html).toContain("CSV")
    expect(html.indexOf("CSV")).toBeLessThan(html.indexOf("Rapports</h1>"))
  })
})
