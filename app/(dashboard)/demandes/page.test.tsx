import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { hideClassFor, rowHoverInkTint, tableShellClass } from "@/components/display"

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

  // #286: the page used to decide this with its own inline comparison. It now
  // asks the guard over the declared set, so the export is offered to exactly
  // the Roles the set admits — the same answer /api/csv gives, which is the
  // whole point: a button that is offered and then refused is the defect this
  // ticket closed. Driven by the signed-in Role, so it fails if either the page
  // or the set is wrong.
  it("offers the CSV export to every Role the declared set admits", async () => {
    for (const role of ["FINANCE_ADMIN", "GENERAL_DIRECTION"]) {
      mockUseAuthUser.mockReturnValue({ user: mockUser(role) })

      const { default: DemandesListPage } = await import("./page")
      const html = renderToStaticMarkup(<DemandesListPage />)

      expect(html, role).toContain("CSV")
    }
  })

  it("withholds the CSV export from a Role outside the declared set", async () => {
    for (const role of ["MANAGER", "EMPLOYEE"]) {
      mockUseAuthUser.mockReturnValue({ user: mockUser(role) })

      const { default: DemandesListPage } = await import("./page")
      const html = renderToStaticMarkup(<DemandesListPage />)

      expect(html, role).not.toContain("CSV")
    }
  })

  // The comparison is deleted, not wrapped in a local helper: this is the shape
  // a re-derivation would take, and it must not come back.
  it("reaches the export answer through the guard, not a local Role comparison", async () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
      "utf8"
    )

    expect(source).toMatch(
      /canExportCsv\s*=\s*role\s*\?\s*hasAnyRole\(\s*role\s*,\s*ROLES_MANAGEMENT\s*\)\s*:\s*false/
    )
    expect(source).not.toMatch(/role\s*===\s*"FINANCE_ADMIN"/)
    expect(source).not.toMatch(/role\s*===\s*"GENERAL_DIRECTION"/)
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
    // #307: the shell and the row tint belong to the shared module now, so they
    // are asserted as the module's own output rather than re-pinned as literals.
    expect(html).toContain(tableShellClass)
    // The cell padding and the table's min-width are this page's own
    // shell — no module owns them, so they stay here. The row-hover
    // tint beside them IS spec #305's display module, named below.
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain(rowHoverInkTint)
    expect(html).toContain("min-w-[640px]")
    expect(html).toContain("rounded-full")
    // The pill tones are components/status-pill.tsx's TONE_CLASSES
    // (neutral/pending/success/danger); the pill's rounded-full shape is
    // the same module. This page only chooses the tone.
    expect(html).toContain("bg-[#FBF0DB]")
    expect(html).toContain("En attente (Finance)")
    expect(html).toContain("sm:opacity-0 sm:group-hover:opacity-100")
    expect(html).toContain('role="link"')
    expect(html).not.toContain("Voir</button>")
    expect(html).not.toContain(">Actions</th>")
  })

  // #320: the class-string assertions this file RETAINS are not header
  // leftovers. This one and the `hideClassFor` block below belong to spec
  // #305's shared display module, which owns the hide rule — the header module
  // owns neither. #320 removed only the breadcrumb truncation class this file
  // duplicated from components/page-header.tsx.
  // #307: the three hidden columns now ask the shared rule for their half of
  // the pair. The pin is the module's own output reaching this page's DOM at
  // each breakpoint, plus the count and the absence of a hand-written pair — so
  // it fails both if a migrated cell stops hiding and if the page keeps a
  // private copy beside the import.
  it("hides the Employé column for employees but keeps it ≥sm for managers", async () => {
    const { DemandesTable } = await import("./page")

    const managerHtml = renderToStaticMarkup(
      <DemandesTable demandes={[DEMANDE]} role="MANAGER" />
    )
    expect(
      managerHtml,
      `no cell carries ${hideClassFor({ hideAt: "sm" })} — the Employé column ` +
        `has stopped hiding on a phone`,
    ).toContain(hideClassFor({ hideAt: "sm" }))

    const employeeHtml = renderToStaticMarkup(
      <DemandesTable demandes={[DEMANDE]} role="EMPLOYEE" />
    )
    expect(employeeHtml).not.toContain("Employé")

    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
      "utf8"
    )
    for (const breakpoint of ["sm", "md", "lg"] as const) {
      expect(
        managerHtml,
        `the ${breakpoint} column no longer hides — the class never reached the cell`,
      ).toContain(hideClassFor({ hideAt: breakpoint }))
    }
    expect(
      /className="[^"]*hidden[^"]*(sm|md|lg):table-cell/.test(src),
      "the page still spells a hide pair inline instead of calling hideClassFor",
    ).toBe(false)
    // Six call sites: Employé, Dates and Total, each in a header and a body cell.
    // The role-conditional Employé pair is one pair of them, not two.
    expect(
      (src.match(/hideClassFor\(\{\s*hideAt:/g) ?? []).length,
      "the Demandes table hides six cells below a breakpoint (3 headers + 3 body)",
    ).toBe(6)
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

// #261: the header class pins now live once, in
// components/page-header.test.tsx, against the module that owns them. What
// stays here is the cheap per-page guarantee: this page still renders its
// title through the shared header.
describe("Demandes list page — the shared page header", () => {
  it("renders the page's title", async () => {
    mockUseAuthUser.mockReturnValue({ user: mockUser("MANAGER") })

    const { default: DemandesListPage } = await import("./page")
    const html = renderToStaticMarkup(<DemandesListPage />)

    // This asserts the page's OWN trail rendered through the module, not that
    // an <h1> exists somewhere: a hand-inlined header satisfies a title
    // assertion and is exactly the regression #261 removed. What is left here
    // is the trail the module BUILDS — the page's own crumb labels and the one
    // separator per crumb, which only the module's breadcrumb emits. #320
    // removed this block's duplication of the truncation contract, which
    // components/page-header.tsx pins in full on its own suite.
    // The three-item trail is this page's own, and #262's acceptance criterion
    // for it: one separator per crumb, last item in page treatment.
    expect(html).toContain(">Espace</span>")
    expect(html).toContain(">Demandes de déplacement</span>")
    expect(html.match(/data-slot="breadcrumb-separator"/g)).toHaveLength(2)
  })
})
