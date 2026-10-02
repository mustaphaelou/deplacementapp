import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { formatCurrency } from "@/lib/constants"
import { PIPELINE } from "@/lib/workflow"
import { ETAPE_LABELS } from "@/lib/demande-presentation"

// #283: only the SESSION is faked here. `hasAnyRole` stays REAL, so the guard
// cases below assert what the declared set in `lib/auth/roles.ts` admits rather
// than what a hand-rolled copy of the rule admits.
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/server")>()
  return { ...actual, getAuthUser: vi.fn(), requireAuth: vi.fn() }
})

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
    // Owned by components/page-header.tsx (the h1's md: breakpoint), pinned in
    // full at components/page-header.test.tsx.
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

  // The shared stat component (#255). All three consumers — home, profile and
  // reports — render this one component, so pinning it here pins it for all
  // three. NOTE: `rounded-lg` already resolved to 3px in this app
  // (`--radius: 0.1875rem`, and `.rounded-lg` emits `border-radius: var(--radius)`),
  // so the radius swap is a no-op at render time. The class is now explicit and
  // theme-proof rather than dependent on the radius scale staying at 3px.
  // The value weight is the part that actually changes the type.
  it("renders the shared stat row in the app's 3px palette, with a quietened value", async () => {
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

    // The app's 3px radius, spelled the way every other surface spells it.
    // Scoped to the stat tile's own class run: the CSV action button legitimately
    // keeps its `rounded-lg` button variant, so a bare `rounded-lg` assertion
    // over the whole page would fail on the wrong element.
    // NOT the header module's icon tile: that one is `size-10 ... md:size-12`
    // with no `text-primary` and no value line. This run is components/ui/
    // dashboard-card.tsx — the shared stat card's own icon tile — which no
    // page-header module owns, and its value weight below is the same card's.
    expect(html).toContain(
      'class="flex size-11 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 text-primary'
    )
    expect(html).not.toContain(
      "size-11 shrink-0 items-center justify-center rounded-lg"
    )
    // The value is quietened to the shell's secondary weight; the digits stay
    // tabular so they still align.
    expect(html).toContain("text-2xl font-medium tracking-tight tabular-nums")
    expect(html).not.toContain("text-2xl font-semibold")
    // Still borderless, per #175 — no card chrome crept back in.
    expect(html).not.toContain('data-slot="card"')
    expect(html).not.toContain("shadow-sm")
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

// #283: the page asks the declared set (`ROLES_MANAGEMENT`) instead of
// inlining Roles, and the REAL `hasAnyRole` decides. A Role inside the set
// renders; a Role outside it is redirected to "/". If someone later edits the
// declaration, these cases move with it and the literal pin in
// `lib/auth/roles.test.ts` is what fails loudly.
describe("Rapports page — ROLES_MANAGEMENT guards the page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  async function primeDemandePort() {
    const {
      countDemandes: mockCountDemandes,
      aggregateBudget: mockAggregateBudget,
    } = await import("@/lib/demande")
    ;(mockCountDemandes as ReturnType<typeof vi.fn>).mockImplementation(
      resolveCount
    )
    ;(mockAggregateBudget as ReturnType<typeof vi.fn>).mockResolvedValue(45000)
  }

  it("renders for a Role inside the set", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser("GENERAL_DIRECTION")
    )
    await primeDemandePort()

    const { default: RapportsPage } = await import("./page")
    const html = renderToStaticMarkup(await RapportsPage())

    expect(html).toContain("Rapports")
    expect(html).toContain("Répartition par étape")
  })

  it("redirects to \"/\" for a Role outside the set", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    const { redirect } = await import("next/navigation")

    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUser("MANAGER")
    )

    const { default: RapportsPage } = await import("./page")
    await expect(RapportsPage()).rejects.toThrow("NEXT_REDIRECT: /")

    expect(redirect).toHaveBeenCalledWith("/")
  })
})

// #261: the header class pins live once now, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Rapports page — the shared page header", () => {
  it("renders the page's title", async () => {
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

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. The breadcrumb
    // truncation contract (nowrap list, shrinkable last item, truncate on the
    // page element) is the module's marker — a copy would have to reproduce
    // all three to pass.
    expect(html).toContain(">Administration</span>")
    expect(html.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(1)
  })
})
