import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import RotationGate from "./rotation-gate"

function renderGate() {
  return renderToStaticMarkup(<RotationGate email="yasmine@example.ma" />)
}

describe("RotationGate", () => {
  it("tells the holder a personal password is required before entering", () => {
    const html = renderGate()

    expect(html).toContain("Créez votre mot de passe")
    expect(html).toContain("yasmine@example.ma")
    expect(html).toContain("mot de passe temporaire")
  })

  it("renders the temporary, new and confirm fields with the h-9 hairline treatment", () => {
    const html = renderGate()

    expect(html).toContain("Mot de passe temporaire")
    expect(html).toContain("Nouveau mot de passe")
    expect(html).toContain("Confirmer le nouveau mot de passe")
    expect(html).toContain("h-9 rounded-[3px]")
    expect(html).toContain("focus-visible:ring-1 focus-visible:ring-(--brand)")
  })

  it("submits through the self-service rotation action", () => {
    const html = renderGate()

    expect(html).toContain("Choisir ce mot de passe")
    expect(html).toContain('type="submit"')
  })
})
