import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT: ${path}`)
  }),
}))

function mockUser() {
  return {
    id: "u-1",
    email: "user@example.com",
    name: "User",
    role: "EMPLOYEE",
    departementId: "d-1",
    departement: "IT",
    poste: "Dev",
    avatarUrl: null,
  }
}

describe("403 page (Notion restyle, per #189)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders the forbidden anatomy with ink 403 and fixed accents", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser())

    const { default: ForbiddenPage } = await import("./page")
    const html = renderToStaticMarkup(await ForbiddenPage())

    expect(html).toContain("403")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("font-bold")
    expect(html).not.toContain("text-7xl")
    expect(html).not.toContain("text-muted-foreground/30")
    expect(html).toContain("Accès refusé")
    expect(html).toContain("nécessaires")
    expect(html).toContain("accéder")
    expect(html).toContain("Retour au tableau de bord")
    expect(html).toContain("bg-primary")
    expect(html).toContain("shadow-[0_1px_2px_rgba(15,15,15,0.1)]")
  })

  it("redirects to /login when not authenticated", async () => {
    const { getAuthUser } = await import("@/lib/auth/server")
    ;(getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { default: ForbiddenPage } = await import("./page")
    await expect(ForbiddenPage()).rejects.toThrow("NEXT_REDIRECT: /login")
  })
})
