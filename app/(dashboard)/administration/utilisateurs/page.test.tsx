import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const ACTIVE_USER = {
  id: "u-1",
  email: "yasmine@example.ma",
  nom: "Benali",
  prenom: "Yasmine",
  poste: "Dev",
  role: "MANAGER",
  actif: true,
  telephone: null,
  googleAuthEnabled: true,
  departement: { id: "d-1", nom: "IT" },
}

const INACTIVE_USER = {
  id: "u-2",
  email: "omar@example.ma",
  nom: "El Amrani",
  prenom: "Omar",
  poste: "Compta",
  role: "EMPLOYEE",
  actif: false,
  telephone: null,
  googleAuthEnabled: false,
  departement: { id: "d-2", nom: "Finance" },
}

describe("Utilisateurs administration page", () => {
  it("renders the prototype header anatomy: breadcrumb, icon tile, 40px title, primary action", async () => {
    const { default: UtilisateursPage } = await import("./page")
    const html = renderToStaticMarkup(<UtilisateursPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Nouvel utilisateur")
    expect(html).toContain("utilisateur(s)")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flat table verbatim: no card, hairline borders, muted header, quiet right-aligned actions", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable
        users={[ACTIVE_USER, INACTIVE_USER]}
        onEdit={() => {}}
      />
    )

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("border-y border-border")
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain(
      "hidden px-2 py-2 font-normal text-muted-foreground md:table-cell"
    )
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
    expect(html).toContain("min-w-[500px]")
    expect(html).toContain(">Actions</th>")
    expect(html).toContain(
      "opacity-30 transition-opacity group-hover:opacity-100"
    )
  })

  it("uses neutral StatusPills for roles and Google, semantic tones for status", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable
        users={[ACTIVE_USER, INACTIVE_USER]}
        onEdit={() => {}}
      />
    )

    expect(html).toContain("bg-[#F1F1EF]")
    expect(html).toContain("Google")
    expect(html).toContain("bg-[#E5F3EE]")
    expect(html).toContain("bg-[#FBE9E9]")
    expect(html).toContain("Actif")
    expect(html).toContain("Inactif")
    expect(html).toContain("Responsable")
  })

  it("keeps the responsive column-collapse classes from the list treatment", async () => {
    const { UtilisateursTable } = await import("./page")
    const html = renderToStaticMarkup(
      <UtilisateursTable users={[ACTIVE_USER]} onEdit={() => {}} />
    )

    expect(html).toContain("lg:table-cell")
    expect(html).toContain("md:table-cell")
  })
})
