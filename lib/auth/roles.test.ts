import { describe, it, expect } from "vitest"
import { NAV_ITEMS, ROLES_MANAGEMENT } from "./roles"

// The Role union spelled out as a value, so the "no member outside the union"
// check below is a runtime one rather than a compile-time artefact of the
// `readonly Role[]` annotation.
const ROLE_UNION = [
  "EMPLOYEE",
  "MANAGER",
  "FINANCE_ADMIN",
  "GENERAL_DIRECTION",
] as const

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

// The set of Roles that may manage the application (spec #281). Pinned Role by
// Role and by length: appending, dropping, reordering or retyping a member is a
// behaviour change on every surface that consults it, so a silent edit to the
// declaration has to fail here.
describe("ROLES_MANAGEMENT", () => {
  it("is exactly FINANCE_ADMIN then GENERAL_DIRECTION, in that order", () => {
    expect([...ROLES_MANAGEMENT]).toEqual(["FINANCE_ADMIN", "GENERAL_DIRECTION"])
    expect(ROLES_MANAGEMENT).toHaveLength(2)
  })

  it("holds no Role outside the Role union", () => {
    for (const role of ROLES_MANAGEMENT) {
      expect(ROLE_UNION).toContain(role)
    }
  })
})
