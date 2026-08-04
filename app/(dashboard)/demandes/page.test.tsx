import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const { mockSearchParams, mockUseAuthUser } = vi.hoisted(() => ({
  mockSearchParams: { etape: "" },
  mockUseAuthUser: vi.fn(),
}))

vi.mock("@/lib/auth/client", () => ({
  useAuthUser: mockUseAuthUser,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "etape" ? mockSearchParams.etape : null),
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
    expect(html).toContain("?etape=MANAGER_REVIEW")
    expect(html).toContain("?etape=FINAL")
    expect(html).not.toContain("Brouillons")
  })

  it("gives employees Brouillons tab and the Nouvelle demande action", async () => {
    mockUseAuthUser.mockReturnValue({ user: mockUser("EMPLOYEE") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    expect(html).toContain("Brouillons")
    expect(html).toContain("?etape=DRAFT")
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
})
