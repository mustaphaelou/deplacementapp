import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  NAV_ITEMS,
  NAV_LANES,
  NAV_ADMINISTRATION,
  ROLES_MANAGEMENT,
  type NavItem,
  type Role,
} from "./roles"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

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

// The administration entries, read off a list the way the sidebar's own
// groupNavItems reads them — by href, not by Role. That is what lets the
// expectation below be derived from the set instead of written out by hand.
const administrationOf = (items: NavItem[]): NavItem[] =>
  items.filter(
    (item) =>
      item.href === "/administration" || item.href.startsWith("/administration/")
  )

describe("NAV_ITEMS — the administration block comes from the declared set", () => {
  // The whole point of #285: the navigation used to be a fourth, hand-written
  // statement of who may manage the application, and it disagreed with the
  // guards. The expectation is therefore DERIVED from ROLES_MANAGEMENT — a
  // parallel list of Role → entries here would re-create the defect.
  it("offers each Role exactly the administration entries the set admits", () => {
    for (const role of ROLE_UNION) {
      const offered = administrationOf(NAV_ITEMS[role] ?? [])
      const admitted = ROLES_MANAGEMENT.includes(role)
        ? administrationOf([...NAV_ADMINISTRATION])
        : []

      expect(offered.map((item) => item.href), `Role ${role}`).toEqual(
        admitted.map((item) => item.href)
      )
    }
  })

  // Non-vacuity: a set that admitted nothing, or a block that had been emptied,
  // would satisfy the assertion above while offering nobody anything.
  it("has an administration block to admit, and admits it to more than nobody", () => {
    expect(NAV_ADMINISTRATION.length).toBeGreaterThan(0)
    expect(ROLES_MANAGEMENT.length).toBeGreaterThan(0)

    for (const role of ROLES_MANAGEMENT) {
      expect(administrationOf(NAV_ITEMS[role] ?? []), `Role ${role}`).toEqual([
        ...NAV_ADMINISTRATION,
      ])
    }
  })

  // The block has exactly ONE home. FINANCE_ADMIN and GENERAL_DIRECTION used to
  // carry byte-identical hand-written « Rapports » copies; identity (not shape)
  // is the assertion, so an exact duplicate fails here while an edited one fails
  // the assertion above.
  it("has no hand-written administration entry left in any Role's block", () => {
    for (const role of ROLE_UNION) {
      for (const item of administrationOf(NAV_ITEMS[role] ?? [])) {
        expect(NAV_ADMINISTRATION, `${role} → ${item.label}`).toContain(item)
      }
    }
  })

  // The lanes belong to the workflow module, not to the management set: this
  // ticket moved the administration entries out from between them, so every
  // non-administration entry must be the lane entry it was before.
  it("leaves the per-Role pipeline lanes exactly as they were", () => {
    for (const role of ROLE_UNION) {
      const lanes = (NAV_ITEMS[role] ?? []).filter(
        (item) => !administrationOf([item]).length
      )

      expect(lanes, `Role ${role}`).toEqual(NAV_LANES[role as Role])
    }
  })
})

// Both call sites assemble the sidebar from the one NAV_ITEMS. A second copy
// written into either of them is the exact shape of the defect this ticket
// removes — a Role shown a link the declared set does not admit — and it would
// pass every assertion above, because those read the module, not the call site.
describe("NAV_ITEMS — the two dashboard call sites share the one block", () => {
  const CALL_SITES = [
    "app/(dashboard)/layout.tsx",
    "app/(dashboard)/page.tsx",
  ]

  for (const callSite of CALL_SITES) {
    it(`${callSite} reads NAV_ITEMS and hand-writes no administration entry`, () => {
      const source = readFileSync(join(REPO_ROOT, callSite), "utf8")

      expect(source).toMatch(/import\s*\{[^}]*\bNAV_ITEMS\b[^}]*\}\s*from\s*"@\/lib\/auth"/)
      for (const item of NAV_ADMINISTRATION) {
        expect(source, callSite).not.toContain(item.href)
        expect(source, callSite).not.toContain(`label: "${item.label}"`)
      }
    })
  }

  it("splits the administration block out of the lanes in one place only", () => {
    const source = readFileSync(join(REPO_ROOT, "lib/auth/roles.ts"), "utf8")

    for (const item of NAV_ADMINISTRATION) {
      const declarations = source.split(`"${item.href}"`).length - 1
      expect(declarations, item.href).toBe(1)
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
