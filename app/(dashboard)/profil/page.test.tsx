import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/utilisateur-service", () => ({
  utilisateurService: { findProfile: vi.fn() },
  UtilisateurNotFoundError: class extends Error {},
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("@/lib/auth/client", () => ({
  signOut: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockProfile = {
  id: "u-1",
  email: "yasmine@example.ma",
  nom: "Benali",
  prenom: "Yasmine",
  poste: "Développeuse",
  telephone: "0612345678",
  avatarUrl: null,
  role: "EMPLOYEE",
  departement: { nom: "IT" },
  dateEmbauche: new Date("2024-03-01"),
  creeLe: new Date("2024-03-01"),
  _count: { demandes: 3 },
}

function mockUser() {
  return {
    id: "u-1",
    email: "yasmine@example.ma",
    name: "Yasmine Benali",
    role: "EMPLOYEE",
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

async function renderPage() {
  const { getAuthUser } = await import("@/lib/auth/server")
  const { utilisateurService } = await import("@/lib/utilisateur-service")
  ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())
  ;(
    utilisateurService.findProfile as ReturnType<typeof vi.fn>
  ).mockResolvedValue(mockProfile)

  const { default: ProfilPage } = await import("./page")
  const element = await ProfilPage()
  return renderToStaticMarkup(element)
}

describe("Profil page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders the 720px document column", async () => {
    const html = await renderPage()
    expect(html).toContain("max-w-[720px]")
  })

  it("replaces the gradient hero with a flat header row: avatar, name, poste, badge, ghost pencil", async () => {
    const html = await renderPage()

    expect(html).not.toContain("bg-gradient-to-br")
    expect(html).not.toContain("from-primary")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Yasmine Benali")
    expect(html).toContain("Développeuse")
    expect(html).toContain('data-slot="avatar"')
    expect(html).toContain('aria-label="Modifier le profil"')
  })

  it("keeps the borderless stat row (no cards)", async () => {
    const html = await renderPage()

    expect(html).toContain("Demandes")
    // The stat value's weight moved from semibold to the shell's secondary
    // medium in #255; the row stays borderless. This pin followed the spec
    // change rather than asserting a weight the spec retired.
    expect(html).toContain("text-2xl font-medium tracking-tight tabular-nums")
    expect(html).toContain("rounded-[3px] bg-primary/10")
    expect(html).not.toContain('data-slot="card"')
  })

  it("uses uppercase hairline-ruled sections with 2-col property display", async () => {
    const html = await renderPage()

    expect(html).toContain("uppercase tracking-[0.06em]")
    expect(html).toContain("bg-border")
    expect(html).toContain("Informations personnelles")
    expect(html).toContain("Sécurité")
    expect(html).toContain("grid gap-x-4 gap-y-5 sm:grid-cols-2")
    expect(html).toContain("text-xs text-muted-foreground")
    expect(html).toContain("mt-0.5 text-sm font-medium")
  })

  it("keeps the password form and the h-9 hairline field treatment", async () => {
    const html = await renderPage()

    expect(html).toContain("Changer le mot de passe")
    expect(html).toContain("Mot de passe actuel")
    expect(html).toContain("h-9 rounded-[3px]")
    expect(html).toContain("focus-visible:ring-1 focus-visible:ring-(--brand)")
  })
})

// #258: the responsive header class set copied verbatim from the #254
// reference. The pins assert the FULL class attribute, not a substring: a
// bare `toContain("text-[40px]")` would also pass on `md:text-[40px]` alone
// and so could not catch a half-applied rule. A green test proves the class
// string is present, never how it looks.
describe("Profil page — the #258 responsive page header", () => {
  it("scales the title 24px below md: and 40px from md: up", async () => {
    const html = await renderPage()

    expect(html).toContain(
      '<h1 class="text-[24px] leading-tight font-bold tracking-[-0.01em] md:text-[40px]">'
    )
  })

  it("has no icon tile, and deliberately no breadcrumb — the #254 asymmetry", async () => {
    const html = await renderPage()

    // This is the one header of the seven that is NOT the #254 anatomy: the
    // round `size-16` avatar above plays the role the square icon tile plays
    // elsewhere, and there is no breadcrumb row. #258 applies the title
    // classes only. A tile or breadcrumb appearing here would be drift — a
    // tile that does not exist today, invented to make the page look uniform.
    expect(html).not.toContain('aria-label="breadcrumb"')
    // Scoped to the header block, like the breakpoint negatives below. The
    // stat row further down the page legitimately carries
    // `rounded-[3px] bg-primary/10` since #255, so a page-wide negative here
    // would fail on the wrong element.
    const headerStart = html.indexOf('class="flex items-center gap-4"')
    const headerBlock = html.slice(headerStart, html.indexOf("</h1>", headerStart))
    expect(headerBlock).not.toContain("rounded-[3px] bg-primary/10")
    expect(headerBlock).not.toContain("bg-primary/10")
    // The avatar is untouched: still 64px, still round, still left of the title.
    expect(html).toContain(
      'data-slot="avatar" class="relative flex shrink-0 overflow-hidden rounded-full size-16"'
    )
    expect(html.indexOf('data-slot="avatar"')).toBeLessThan(
      html.indexOf("Yasmine Benali</h1>")
    )
    // md: is the single shell breakpoint — no other variant may creep into
    // the header row. Scoped to the header: the page body below legitimately
    // carries `sm:grid-cols-2` and `text-2xl`.
    expect(headerBlock).not.toContain("sm:text-[")
    expect(headerBlock).not.toContain("lg:text-[")
    expect(headerBlock).not.toMatch(/(?:sm|lg):size-\d/)
  })

  it("keeps the header anatomy: min-w-0 flex-1 title block and the ghost pencil", async () => {
    const html = await renderPage()

    // The title's wrapper is the pre-existing `min-w-0 flex-1` block, so the
    // long name truncates instead of pushing the actions off the row.
    expect(html).toContain('class="min-w-0 flex-1"')
    // The top-right action keeps its label.
    expect(html).toContain('aria-label="Modifier le profil"')
  })
})
