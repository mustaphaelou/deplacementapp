import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const { mockSearchParams, mockUseAuthUser } = vi.hoisted(() => ({
  mockSearchParams: { etape: "", decision: "" },
  mockUseAuthUser: vi.fn(),
}))

vi.mock("@/lib/auth/client", () => ({
  useAuthUser: mockUseAuthUser,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "etape") return mockSearchParams.etape
      if (key === "decision") return mockSearchParams.decision
      return null
    },
  }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function mockUser(role: string) {
  return {
    id: "u-1",
    name: "Yasmine Benali",
    email: "yasmine@example.ma",
    role,
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

const DEMANDE = {
  id: "d-1",
  numero: "D-2026-001",
  destination: "Casablanca",
  dateDepart: "2026-08-10",
  dateRetour: "2026-08-12",
  totalEstime: 1200,
  etape: "FINANCE_REVIEW",
  decision: "PENDING",
  employe: { prenom: "Yasmine", nom: "Benali" },
  employeId: "u-1",
}

describe("Demandes list page", () => {
  beforeEach(() => {
    mockSearchParams.etape = ""
    mockSearchParams.decision = ""
    mockUseAuthUser.mockReturnValue({ user: mockUser("MANAGER") })
  })

  it("renders the prototype header anatomy: breadcrumb, 40px title, subtitle, no top navbar", async () => {
    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Demandes")
    expect(html).toContain("demande(s)")
    expect(html).not.toContain('aria-label="Menu"')
    expect(html).not.toContain('data-slot="card"')
  })

  it("shows role-aware tab pills on the role's queue etape", async () => {
    mockUseAuthUser.mockReturnValue({ user: mockUser("MANAGER") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain("Toutes")
    expect(html).toContain("En attente")
    expect(html).toContain("Finalisées")
    // renderToStaticMarkup escapes `&` as `&amp;`; decode to pin the href itself.
    expect(html.replace(/&amp;/g, "&")).toContain(
      "?etape=MANAGER_REVIEW&decision=PENDING"
    )
    expect(html).toContain("?etape=FINAL")
    expect(html).not.toContain("Brouillons")
  })

  it("gives employees Brouillons tab and the Nouvelle demande action", async () => {
    mockUseAuthUser.mockReturnValue({ user: mockUser("EMPLOYEE") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain("Brouillons")
    expect(html).toContain("?etape=DRAFT")
    expect(html).not.toContain("&decision=")
    expect(html).toContain("Nouvelle demande")
    expect(html).not.toContain("CSV")
  })

  it("gives finance the ghost CSV export with tooltip", async () => {
    mockUseAuthUser.mockReturnValue({ user: mockUser("FINANCE_ADMIN") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain("CSV")
    expect(html).toContain('data-slot="tooltip-trigger"')
  })

  it("keeps the active tab pill highlighted from the etape param", async () => {
    mockSearchParams.etape = "FINAL"

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain("bg-[#F1F1EF] font-medium")
  })

  it("renders the flat table verbatim: hairline borders, no card, StatusPill, no actions column", async () => {
    const { DemandesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <DemandesTable demandes={[DEMANDE]} role="MANAGER" />
    )

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("border-y border-border")
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
    expect(html).toContain("min-w-[640px]")
    expect(html).toContain("rounded-full")
    expect(html).toContain("bg-[#FBF0DB]")
    expect(html).toContain("En attente (Finance)")
    expect(html).toContain("sm:opacity-0 sm:group-hover:opacity-100")
    expect(html).toContain('role="link"')
    expect(html).not.toContain("Voir</button>")
    expect(html).not.toContain(">Actions</th>")
  })

  it("hides the Employé column for employees but keeps it ≥sm for managers", async () => {
    const { DemandesTable } = await import("./page")

    const managerHtml = renderToStaticMarkup(
      <DemandesTable demandes={[DEMANDE]} role="MANAGER" />
    )
    expect(managerHtml).toContain("hidden px-2 py-2 font-normal text-muted-foreground sm:table-cell")

    const employeeHtml = renderToStaticMarkup(
      <DemandesTable demandes={[DEMANDE]} role="EMPLOYEE" />
    )
    expect(employeeHtml).not.toContain("Employé")
  })

  it("renders the module's compact label for a rejected demande: Rejetée (Manager)", async () => {
    const { DemandesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <DemandesTable
        demandes={[{ ...DEMANDE, etape: "MANAGER_REVIEW", decision: "REJECTED" }]}
        role="MANAGER"
      />
    )

    expect(html).toContain("Rejetée (Manager)")
    expect(html).not.toContain("En attente")
    expect(html).toContain("bg-[#FBE9E9]")
  })
})

// #254: the demandes list page is the second half of the reference
// implementation #258 copies to the remaining seven pages. Same rule as the
// home page — title 24px → 40px at md, tile 40px → 48px at md, breadcrumb
// truncated to one line — so the class set is asserted in full on both sides
// of the breakpoint. A bare toContain("text-[40px]") would also match
// "md:text-[40px]", so it cannot tell the two apart.
describe("Demandes list page — the #254 responsive page header", () => {
  it("scales the title 24px below md: and 40px from md: up", async () => {
    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("scales the icon tile 40px below md: and 48px from md: up", async () => {
    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain(
      'class="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 md:size-12"'
    )
    // md: is the single shell breakpoint — no other variant may creep in.
    expect(html).not.toMatch(/(?:sm|lg):(?:text-\[|size-)\d/)
  })

  it("truncates the breadcrumb to one line instead of wrapping it", async () => {
    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    // twMerge drops the primitive's flex-wrap for flex-nowrap, so the override
    // lands last and `flex-wrap` is absent from the output entirely.
    expect(html).toContain(
      'class="flex items-center gap-1.5 text-sm wrap-break-word text-muted-foreground flex-nowrap"'
    )
    expect(html).not.toContain("flex-wrap")
    expect(html).toContain('data-slot="breadcrumb" class="min-w-0"')
    expect(html).toContain(
      'data-slot="breadcrumb-item" class="inline-flex items-center gap-1 min-w-0"'
    )
    expect(html).toContain(
      'class="text-foreground min-w-0 truncate font-medium"'
    )
  })

  it("keeps the row's actions on the right with their labels", async () => {
    // The action is role-gated, so render as the role that actually gets it.
    mockUseAuthUser.mockReturnValue({ user: mockUser("EMPLOYEE") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    // The breadcrumb row is still justify-between, so the action block stays
    // top-right of the title, and the mt-6 rhythm is unchanged.
    expect(html).toContain('class="flex items-center justify-between"')
    expect(html).toContain('class="mt-6 flex items-center gap-4"')
    expect(html).toContain("Nouvelle demande")
  })
})
