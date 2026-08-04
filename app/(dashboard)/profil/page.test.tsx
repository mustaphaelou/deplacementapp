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
  ;(utilisateurService.findProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockProfile
  )

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
    expect(html).toContain("data-slot=\"avatar\"")
    expect(html).toContain('aria-label="Modifier le profil"')
  })

  it("keeps the borderless stat row (no cards)", async () => {
    const html = await renderPage()

    expect(html).toContain("Demandes")
    expect(html).toContain("text-2xl font-semibold")
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
