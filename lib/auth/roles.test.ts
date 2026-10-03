import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  NAV_ITEMS,
  NAV_LANES,
  NAV_ADMINISTRATION,
  ROLES_MANAGEMENT,
  TOUS_LES_ROLES,
  lireRole,
  type NavItem,
  type Role,
} from "./roles"
import { lienFileAttente } from "../workflow"

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

// Every nav link that means « the DemandeDeplacements waiting for me » IS the
// pipeline's composition for its Role (#304).
//
// This used to assert two literal URLs — which is why renaming a lane in the
// pipeline broke a test that was asserting a STRING rather than a rule, and
// why the hand-typed navigation literals could drift from the dashboard's
// without anything noticing. Now the lane lives in exactly one declaration, the
// link in exactly one composition, and each site is checked against that
// composition. A site that re-derives its href by hand fails here; a lane rename
// changes one declaration and this test stays green.
//
// The lane's own NAME is pinned in `lib/workflow.test.ts`, beside the
// declaration that spells it — not here. Spelling it here is the pin this
// ticket deletes.
describe("NAV_ITEMS queue links ARE the composition for their Role", () => {
  it("gives each Role the « waiting » link the pipeline composes for it", () => {
    expect(
      NAV_ITEMS.MANAGER.find((item) => item.label === "En Attente")?.href
    ).toBe(lienFileAttente("MANAGER"))

    expect(
      NAV_ITEMS.GENERAL_DIRECTION.find(
        (item) => item.label === "Approbations Finales"
      )?.href
    ).toBe(lienFileAttente("GENERAL_DIRECTION"))
  })

  // The rule, applied to every Role rather than to the two the table happens to
  // carry today — so a third queue link added tomorrow is covered without a test
  // edit. A Role with no queue link contributes nothing, which is correct: only
  // MANAGER and GENERAL_DIRECTION are handed a « waiting » entry.
  it("carries no hand-composed queue link that disagrees with its Role", () => {
    const queueLinksOf = (items: NavItem[]): NavItem[] =>
      items.filter(
        (item) =>
          /^\/demandes\?etape=/.test(item.href) &&
          !item.href.includes("etape=DRAFT") &&
          !item.href.includes("etape=FINAL")
      )

    let checked = 0
    for (const role of ROLE_UNION) {
      for (const item of queueLinksOf(NAV_ITEMS[role] ?? [])) {
        // The pending Decision is not a substring check any more: it is part of
        // what the composition IS. A link that forgot it differs from the
        // composition, and this fails.
        expect(item.href, `${role} → ${item.label}`).toBe(lienFileAttente(role))
        checked++
      }
    }

    // Non-vacuity: a table emptied of its queue links would satisfy the loop
    // above while asserting nothing.
    expect(checked).toBeGreaterThanOrEqual(2)
  })

  // The scoping rule, pinned in the OTHER direction: the links that mean
  // something else are not compositions of the waiting link and must not be
  // swept into it. « my drafts » and « finalised » name a Utilisateur's OWN
  // DemandesDeplacement, which is a different question entirely.
  it("leaves the links that mean something else out of the composition", () => {
    for (const role of ROLE_UNION) {
      for (const item of NAV_ITEMS[role] ?? []) {
        if (item.href.includes("etape=DRAFT") || item.href.includes("etape=FINAL")) {
          expect(item.href, `${role} → ${item.label}`).not.toBe(
            lienFileAttente(role)
          )
        }
      }
    }

    // And the plain list entry is not a queue link at all. Asserted positively:
    // a negative against `lienFileAttente` alone would also pass if the entry had
    // been deleted, since a missing item yields `undefined`.
    expect(
      NAV_ITEMS.MANAGER.find((item) => item.label === "Demandes Équipe")?.href
    ).toBe("/demandes")
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

  // #285 asks the block to be derived from the set, and it is — but deriving
  // BOTH sides of the assertion above from NAV_ADMINISTRATION means the block's
  // own membership was unpinned: deleting the « Société » entry left every
  // suite green (verified by injection), which is the omission this spec
  // exists to make loud, on the one surface #284 widened. So the membership is
  // pinned here, literally — this list is the four /administration surfaces
  // the guards govern, and a fifth or a missing one is a deliberate edit.
  it("holds exactly the four administration surfaces the guards govern", () => {
    expect(NAV_ADMINISTRATION.map((item) => item.href)).toEqual([
      "/administration/societe",
      "/administration/utilisateurs",
      "/administration/vehicules",
      "/administration/rapports",
    ])
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

// The validating reader, as a pure function over a string: no session, no
// engine, no database. It is total, so every input below is an answer rather
// than a throw — a throwing reader would turn a data condition into a crash on
// a page that today at least renders.
describe("lireRole", () => {
  it("returns each Role of the union as itself", () => {
    for (const role of ROLE_UNION) {
      expect(lireRole(role), role).toBe(role)
    }
  })

  // The absent value is refused rather than defaulted. This is the edge of the
  // Utilisateur-visible change: an absent stored role used to arrive at the
  // pages as "" — a string outside the vocabulary — and was swallowed by a
  // redirect loop. It is now a refusal, at the seam, once.
  it("returns nothing for the absent value", () => {
    expect(lireRole(null)).toBeNull()
    expect(lireRole(undefined)).toBeNull()
  })

  it("returns nothing for the empty string", () => {
    expect(lireRole("")).toBeNull()
  })

  it("returns nothing for a value outside the vocabulary", () => {
    for (const stored of ["NOT_A_ROLE", "admin", "Employé", "EMPLOYEE ", "EMPLOY"]) {
      expect(lireRole(stored), stored).toBeNull()
    }
  })

  // No normalisation: the reader reads a stored value, it does not repair one.
  // « finance_admin » and «Finance_Admin» are the same Role to a human and a
  // refusal here, which is why a differently-cased row is a refusal at the seam
  // rather than a silently-permitted Utilisateur.
  it("does not normalise casing, whitespace or accents", () => {
    expect(lireRole("finance_admin")).toBeNull()
    expect(lireRole("Employee")).toBeNull()
    expect(lireRole(" EMPLOYEE")).toBeNull()
    expect(lireRole("EMPLOYEE\n")).toBeNull()
  })

  // Non-vacuity: a reader returning nothing for everything would satisfy every
  // refusal above while refusing every Utilisateur in the deployment. The
  // accepted set is asserted as a set, and the acceptance is asserted above, so
  // the two together pin a reader that both admits and refuses.
  it("admits the whole union and refuses everything else", () => {
    const accepted = Object.keys(NAV_LANES).filter((role) => lireRole(role) === role)
    expect(accepted.length).toBe(Object.keys(NAV_LANES).length)
    expect(accepted.length).toBeGreaterThan(0)
  })
})

// THE LOCKOUT GUARD — the acceptance criterion that is not negotiable.
//
// ADR-0021 adds a fifth Role (the deployment's Administrateur). The day that
// Role reaches the DATABASE and not `TOUS_LES_ROLES`, every Administrateur is
// refused at the seam: the guaranteed administrator of a live deployment
// locked out by a type-safety change, with no crash and no log line to grep —
// just a Utilisateur who cannot sign in.
//
// So the reader's accepted set is DERIVED from the Role vocabulary, and this
// asserts the two are the same set. Widening the union without widening the
// reader fails here, at the moment of the widening, which is the entire point.
describe("the reader's accepted set and the Role union are the same set", () => {
  it("accepts exactly the Roles the union names — neither more nor fewer", () => {
    expect([...TOUS_LES_ROLES].sort()).toEqual([...ROLE_UNION].sort())
  })

  it("accepts every Role the navigation declares, and no other", () => {
    // The union's own runtime witness: NAV_LANES is declared
    // `Record<Role, NavItem[]>`, so adding a Role to the union forces a lane
    // for it, and its keys are exactly the union's members.
    const fromNav = Object.keys(NAV_LANES)
    expect(fromNav.length).toBeGreaterThan(0)
    expect([...TOUS_LES_ROLES].sort()).toEqual([...fromNav].sort())
  })

  it("round-trips every member of the accepted set through the reader", () => {
    for (const role of TOUS_LES_ROLES) {
      expect(lireRole(role), role).toBe(role)
    }
  })
})

// The carve-out: `roles.ts:136` keeps its `as Role`, because the navigation
// table's keys are keyed permissively ON PURPOSE. The ticket's criterion and its
// Out of Scope conflict there, and the specific carve-out wins. What makes that
// resolution safe is the property pinned here: a Role this build does not have
// produces a RESULT, not a throw. If the cast were removed, this is the call
// that would start throwing — on every request, not only on that Utilisateur's.
describe("the navigation table tolerates a Role this build does not have", () => {
  it("answers for an unknown Role instead of throwing", () => {
    const unknown = "ADMINISTRATEUR"
    expect(ROLE_UNION).not.toContain(unknown)

    // The reader refuses it — that is the seam's job and it is correct.
    expect(lireRole(unknown)).toBeNull()

    // But the nav lookup, which keys on whatever is in the table, must not
    // throw. Nothing may be asserted about the CONTENT (a build without that
    // Role has no entries for it); the property is that it returns.
    const lanes = NAV_LANES[unknown as Role]
    expect(() => NAV_ITEMS[unknown]).not.toThrow()
    expect(NAV_ITEMS[unknown] ?? []).toEqual(lanes ?? [])
  })

  it("yields no administration block for a Role outside ROLES_MANAGEMENT", () => {
    // `NAV_ITEMS` has no entry for a Role this build does not have, so the
    // lookup a sidebar does for one is a MISS — and `layout.tsx` already
    // coalesces that miss to `[]`. The property is that the miss is a miss and
    // not a crash, which is what the Out of Scope section is protecting.
    expect(NAV_ITEMS["ADMINISTRATEUR" as Role]).toBeUndefined()
    expect((NAV_ITEMS["ADMINISTRATEUR" as Role] ?? [])).toEqual([])
  })
})
