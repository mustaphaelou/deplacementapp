import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const AVAILABLE_VEHICULE = {
  id: "v-1",
  nom: "Dacia Logan",
  immatriculation: "12345-A-6",
  disponible: true,
}

const BUSY_VEHICULE = {
  id: "v-2",
  nom: "Peugeot 208",
  immatriculation: "67890-B-1",
  disponible: false,
}

describe("Véhicules administration page", () => {
  it("renders the prototype header anatomy: breadcrumb, icon tile, 40px title, primary action", async () => {
    const { default: VehiculesPage } = await import("./page")
    const html = renderToStaticMarkup(<VehiculesPage />)

    expect(html).toContain('aria-label="breadcrumb"')
    expect(html).toContain("Administration")
    expect(html).toContain("text-[40px]")
    expect(html).toContain("Ajouter un véhicule")
    expect(html).toContain("véhicule(s)")
    expect(html).not.toContain('data-slot="card"')
  })

  it("renders the flat table verbatim: no card, hairline borders, muted header, quiet right-aligned actions", async () => {
    const { VehiculesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <VehiculesTable
        vehicules={[AVAILABLE_VEHICULE, BUSY_VEHICULE]}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    )

    expect(html).not.toContain('data-slot="card"')
    expect(html).toContain("border-y border-border")
    expect(html).toContain("px-2 py-2 font-normal text-muted-foreground")
    expect(html).toContain("px-2 py-2.5")
    expect(html).toContain("hover:bg-[rgba(55,53,47,0.024)]")
    expect(html).toContain("min-w-[300px]")
    expect(html).toContain(">Actions</th>")
    expect(html).toContain(
      "opacity-30 transition-opacity group-hover:opacity-100"
    )
    expect(html).toContain('aria-label="Modifier Dacia Logan"')
    expect(html).toContain('aria-label="Supprimer Dacia Logan"')
  })

  it("keeps the semantic status tones: Disponible success, En mission pending", async () => {
    const { VehiculesTable } = await import("./page")
    const html = renderToStaticMarkup(
      <VehiculesTable
        vehicules={[AVAILABLE_VEHICULE, BUSY_VEHICULE]}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    )

    expect(html).toContain("bg-[#E5F3EE]")
    expect(html).toContain("bg-[#FBF0DB]")
    expect(html).toContain("Disponible")
    expect(html).toContain("En mission")
    expect(html).toContain("font-mono")
  })
})
