import { describe, it, expect } from "vitest"
import { NAV_ITEMS } from "./roles"

// Every nav link that opens the demandes list on a queue stage asks for
// pending rows — a decided demande is not « en attente » (spec #226).
describe("NAV_ITEMS queue links ask pending", () => {
  it("carries decision=PENDING on the queue-stage quick links", () => {
    expect(
      NAV_ITEMS.MANAGER.find((item) => item.label === "En Attente")?.href
    ).toBe("/demandes?etape=MANAGER_REVIEW&decision=PENDING")

    expect(
      NAV_ITEMS.GENERAL_DIRECTION.find(
        (item) => item.label === "Approbations Finales"
      )?.href
    ).toBe("/demandes?etape=DIRECTION_REVIEW&decision=PENDING")
  })

  it("carries the filter on every queue-stage demandes link", () => {
    const queueLinks = Object.values(NAV_ITEMS)
      .flat()
      .filter((item) => /^\/demandes\?etape=/.test(item.href))
      .filter(
        (item) =>
          !item.href.includes("etape=DRAFT") &&
          !item.href.includes("etape=FINAL")
      )

    expect(queueLinks.length).toBeGreaterThanOrEqual(2)
    for (const item of queueLinks) {
      expect(item.href).toContain("&decision=PENDING")
    }
  })
})
