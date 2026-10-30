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
import { roleEnum } from "@/db/schema/enums"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

// The Role union spelled out as a value, so the "no member outside the union"
// checks below are runtime ones rather than a compile-time artefact of the
// `readonly Role[]` annotation.
//
// This transcription used to be what the lockout guard compared `TOUS_LES_ROLES`
// against — a constant compared against another copy of itself, with the column
// nowhere in the assertion. It is derived from the one list now, and the
// DATABASE is compared separately in the witness block at the end of this file,
// so a Role that reaches the column is what the guard is actually checked
// against. The separate name is kept because several checks here want « every
// Role the union names », which is a claim about the union.
const ROLE_UNION: readonly Role[] = TOUS_LES_ROLES

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
// So the reader's accepted set is compared against what the DATABASE declares,
// read off the column's own `roleEnum.enumValues` at runtime rather than
// restated. That is the pattern `demande-types.row-types.test.ts` established
// for `Etape` and `Decision` (#357); the union is likewise derived from the one
// list, so these are the SAME set by construction and this block is what says
// so at runtime.
describe("the reader's accepted set and the Role union are the same set", () => {
  // There is deliberately NO case here comparing `TOUS_LES_ROLES` against
  // `ROLE_UNION`. It used to read « neither more nor fewer », and after the
  // union became derived from the list it compared a value with ITSELF:
  // emptying `TOUS_LES_ROLES` left it green, which was measured, not assumed.
  // A case that cannot fail inside a block titled « THE LOCKOUT GUARD — the
  // acceptance criterion that is not negotiable » is worse than no case, so it
  // was deleted rather than kept for appearances. The claim that the accepted
  // set and the union agree is now a TYPE-level fact (`Role` is
  // `(typeof TOUS_LES_ROLES)[number]`, so `tsc` holds it), and the claim that
  // matters — that the accepted set is the DATABASE's vocabulary — is a runtime
  // one, in the witness block below.

  it("accepts every Role the navigation declares, and no other", () => {
    // `NAV_LANES` is declared `Record<Role, NavItem[]>`, so adding a Role to the
    // union forces a lane for it, and its keys are exactly the union's members.
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

// THE DATABASE WITNESS — the half that was missing (#357).
//
// `roleEnum` is the copy that owns the column, and until now it was read by
// NOTHING: the guard above compared `TOUS_LES_ROLES` against a transcription of
// the union, so a Role added to the database passed the lockout guard and every
// holder of it was refused at the seam. This block reads the vocabulary off the
// column's own declaration at runtime, exactly as
// `demande-types.row-types.test.ts:81` does for `Etape` and `Decision`.
//
// `TOUS_LES_ROLES` is NOT derived from `roleEnum` here even though that would be
// the shorter way to write it: `db/schema/enums.ts` imports `pgEnum` from
// `drizzle-orm/pg-core`, and this module is reachable from two `"use client"`
// pages, so a value import would pull the ORM into the browser bundle.
// `scripts/management-wiring.test.ts` pins that, in both the alias and the
// relative-path form. The reason is argued once, in full, in `roles.ts` — it is
// repeated here only because the reader of a witness needs to know WHY the two
// sides are separate, and two copies of one argument drift.
describe("the reader's accepted set is the vocabulary the database declares", () => {
  const ROLES_THE_COLUMN_DECLARES = [...roleEnum.enumValues] as Role[]

  it("is the same set, read off the column rather than restated", () => {
    // Sorted: the claim is about the SET. A witness and a transcription may
    // disagree on order without either being wrong.
    expect([...TOUS_LES_ROLES].sort()).toEqual(
      [...ROLES_THE_COLUMN_DECLARES].sort()
    )

    // Non-vacuity: a witness that named nothing would satisfy the comparison
    // above vacuously. Both sides are asserted to be real vocabularies first,
    // and neither may be empty — an emptied `TOUS_LES_ROLES` would refuse every
    // Utilisateur at the seam, which is the lockout this guards against.
    expect(ROLES_THE_COLUMN_DECLARES.length).toBeGreaterThan(0)
    expect(TOUS_LES_ROLES.length).toBeGreaterThan(0)
  })

  it("carries the vocabulary in both directions, so neither copy is vacuous", () => {
    // The reader admits every Role the column declares and refuses one it does
    // not. Read off the column, so this is the database's vocabulary being
    // round-tripped and not the list compared with itself.
    for (const role of ROLES_THE_COLUMN_DECLARES) {
      expect(lireRole(role), role).toBe(role)
    }
    expect(lireRole("ADMINISTRATEUR")).toBeNull()
  })

  it("admits a Role added to the column, which is what the lockout turns on", () => {
    // The lockout, stated positively rather than as an absence: whatever the
    // column declares, the reader admits and the navigation can answer for. A
    // fifth Role added to `roleEnum` and not to `TOUS_LES_ROLES` is caught by
    // the set-equality case above; this one says what the reader does with it.
    for (const role of ROLES_THE_COLUMN_DECLARES) {
      expect(TOUS_LES_ROLES as readonly string[]).toContain(role)
      expect(NAV_LANES[role], `no lane declared for ${role}`).toBeDefined()
    }
  })

  // The witness must READ the column. Set-equality alone cannot tell a witness
    // apart from a transcription: swap the two sources and every case above still
    // passes, because a list compared against itself is trivially equal — which is
    // the pre-#357 defect (a constant compared against another copy of itself)
    // surviving in a new location, and it was measured going green before this
    // case existed.
    //
    // So the SOURCE is pinned: this file must read `roleEnum.enumValues` inside
    // the witness DECLARATION, and nowhere else in the file — otherwise a
    // transcript could sit in the declaration while the real reading lives in a
    // comment two hundred lines away.
    //
    // The slice is normalised before it is read, because a line-based slice is
    // formatting-coupled: splitting the declaration across prettier-legal lines
    // made this case fail on correct code, measured before it was fixed. The
    // needle is also the declaration's own, so renaming the constant moves the
    // search with it instead of silently passing.
    it("reads the witness off the column rather than off a restatement", () => {
      // Comments are stripped first, exactly as `role-casts.test.ts` does: a
      // comment that NAMES the reading must not be able to satisfy a pin about
      // the reading. Stripping them also makes the slice immune to the comment
      // block above it.
      const source = readFileSync(
        join(REPO_ROOT, "lib/auth/roles.test.ts"),
        "utf8"
      )
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")

      // The whole declaration, however it is wrapped, collapsed to one line. The
      // slice runs to the BLANK line that ends the declaration rather than to
      // the first newline: a prettier-legal rewrap must not redden correct code,
      // and that failure was measured before this was written.
      const start = source.indexOf("ROLES_THE_COLUMN_DECLARES")
      expect(start).toBeGreaterThan(-1)
      const rest = source.slice(start)
      const end = rest.indexOf("\n\n")
      expect(end).toBeGreaterThan(0)
      const declaration = rest.slice(0, end).replace(/\s+/g, " ")

      expect(declaration).toContain("roleEnum.enumValues")

      // And it is a SPREAD of the column, not the column object itself: the set
      // comparisons above sort, and `enumValues` is a mutable array the column
      // owns.
      //
      // The shape is matched TOLERANTLY because the declaration is read after a
      // whitespace collapse, and prettier is free to wrap it. Measured failures
      // that shaped this line: a strict `\[\.\.\.` went red on a rewrap that put
      // `[` and `...` on different lines; adding `\s*` then went red on the
      // TRAILING COMMA the same rewrap leaves before `]`. Both were correct
      // code reddened by a formatting choice, so the pattern now accepts any
      // legal spacing and an optional trailing comma.
      expect(declaration).toMatch(
        /\[\s*\.\.\.\s*roleEnum\.enumValues\s*,?\s*\]/
      )

      // The reading must be the DECLARATION's own, and the only DECLARATION
      // that reads the column. This deliberately does not assert the literal
      // appears nowhere else in the file: the assertion above necessarily
      // contains it, and a pin whose own needle breaks it is a pin that always
      // fails. What would defeat it is a SECOND witness — another `const …`
      // bound to `[...roleEnum.enumValues]` — so those are counted rather than
      // searched for.
      const declarations = source.match(
        /const\s+\w+\s*=\s*\[?\s*\.\.\.roleEnum\.enumValues/g
      )
      expect(declarations).toHaveLength(1)
      expect(declarations?.[0]).toContain("ROLES_THE_COLUMN_DECLARES")
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
