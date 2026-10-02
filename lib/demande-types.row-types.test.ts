import { describe, it, expect } from "vitest"
import type { DemandeDeplacement } from "@/lib/demande-types"
import type { Etape, Decision } from "@/lib/workflow"
import { PIPELINE } from "@/lib/workflow"
import { etapeEnum, decisionEnum } from "@/db/schema/enums"

/**
 * #295 — the demande row's Etape and Decision are the pipeline's vocabulary.
 *
 * A fixture written WITHOUT a cast proves nothing on its own: `etape: "DRAFT"`
 * typechecks just as well when the field is a plain `string`. The pin that
 * bites is the direction this file pins — the row type must REFUSE a lane the
 * database cannot store.
 *
 * The two `@ts-expect-error` directives below are the load-bearing part. Each
 * asserts "this assignment does not compile". If `etape` ever widens back to
 * `string`, the directives become unused, tsc reports TS2578 ("Unused
 * '@ts-expect-error' directive"), and `npm run typecheck` goes RED. That pin
 * cannot be silently undone by someone editing a type: it fails whether the
 * widening is deliberate or accidental.
 *
 * Verified by mutation on this tree: widening `etape` and `decision` to
 * `string` in lib/demande-types.ts turns this file red here, and red again at
 * the detail page and in the construction fixtures in
 * lib/demande/queries.test.ts.
 */

// ─── The pin: the row type refuses what the database cannot store ──────────
//
// Wrapped in a function rather than left at module scope so the values are
// genuinely used (the constants exist to be REJECTED by tsc, not to be read),
// which also keeps the linter honest about them. Reachability is impossible —
// the file does not compile if the narrowing is ever undone.

function theDatabaseCannotStoreThese() {
  // A lane the pipeline does not name.
  // @ts-expect-error -- a lane the database cannot store must not compile (#295)
  const notALane: DemandeDeplacement["etape"] = "NOT_AN_ETAPE"

  // A Decision the pipeline does not name.
  // @ts-expect-error -- a Decision the database cannot store must not compile (#295)
  const notADecision: DemandeDeplacement["decision"] = "ALMOST_APPROVED"

  return [notALane, notADecision]
}

// ─── The converse: every value the pipeline DOES name compiles ────────────
//
// Spelled out as literals, the way a fixture spells them. This half would keep
// compiling under the old widening, which is why it is only half the pin —
// but it is what makes the pair meaningful: the type accepts exactly the
// pipeline's vocabulary, and (via the directives above) nothing else.
//
// The lists are here to be COMPARED, not to be believed. Each one is set-equal
// against a runtime witness of the same vocabulary — the `pgEnum` tuples the
// row's columns are declared from, and `PIPELINE`'s own stage ids — so a sixth
// Etape or a fifth Decision fails HERE, at the moment of the widening, rather
// than being discovered by whichever consumer happens to be strict first. A
// hand-written list of the right length proves nothing about a set it never
// compares itself to.
const EVERY_ETAPE: DemandeDeplacement["etape"][] = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

const EVERY_DECISION: DemandeDeplacement["decision"][] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
]

// The witnesses. `etapeEnum` / `decisionEnum` are the declarations
// `demandesDeplacement`'s columns are built from, and drizzle keeps their
// members on `.enumValues` — so this is the vocabulary itself, read at runtime
// rather than restated. `PIPELINE` is the pipeline's own ordered stage list,
// whose `id` is typed `Etape`, so it cannot name a lane outside the union.
const ETAPES_THE_COLUMN_DECLARES = [...etapeEnum.enumValues] as Etape[]
const DECISIONS_THE_COLUMN_DECLARES = [...decisionEnum.enumValues] as Decision[]
const ETAPES_THE_PIPELINE_DECLARES = PIPELINE.map((stage) => stage.id)

// The row's fields are the pipeline's unions, not merely assignable to them:
// a lane the pipeline names round-trips through the row's field unchanged.
function acceptsEtape(etape: Etape): DemandeDeplacement["etape"] {
  return etape
}

function acceptsDecision(decision: Decision): DemandeDeplacement["decision"] {
  return decision
}

describe("the demande row's Etape and Decision are the pipeline's vocabulary", () => {
  it("refuses a lane and a Decision the database cannot store", () => {
    // Compiled, not run: the two assignments inside this function exist to be
    // REJECTED by tsc. Reaching this line at all means the narrowing holds.
    // Were `etape` widened back to `string`, the `@ts-expect-error` directives
    // would become unused and `npm run typecheck` would fail with TS2578.
    expect(typeof theDatabaseCannotStoreThese).toBe("function")
  })

  it("names every Etape and Decision the pipeline names, and no others", () => {
    // Reachable only because the file compiles: the `@ts-expect-error`
    // directives above hold, and these literals are accepted.
    expect(EVERY_ETAPE).toHaveLength(5)
    expect(EVERY_DECISION).toHaveLength(4)

    // No duplicates: the field is a union, so a repeated lane would be a
    // transcription error in the schema's enum rather than a second value.
    expect(new Set(EVERY_ETAPE).size).toBe(EVERY_ETAPE.length)
    expect(new Set(EVERY_DECISION).size).toBe(EVERY_DECISION.length)

    // Set-equality against the runtime witnesses, which is what makes the
    // name of this test true. The two `@ts-expect-error` directives reject two
    // SPECIFIC literals; they do not reject the complement, so without these
    // comparisons a sixth Etape or a fifth Decision would be added to the
    // vocabulary and this test would stay green. Sorted because the claim is
    // about the SET — a witness and a transcription may disagree on order
    // without either being wrong.
    expect([...EVERY_ETAPE].sort()).toEqual([...ETAPES_THE_COLUMN_DECLARES].sort())
    expect([...EVERY_DECISION].sort()).toEqual(
      [...DECISIONS_THE_COLUMN_DECLARES].sort()
    )

    // And the second witness, from the pipeline rather than from the schema:
    // the row's Etape and the pipeline's own stage list are the same set. This
    // is the assertion that catches the two drifting apart — a lane added to
    // `PIPELINE` but not to the column, or the reverse — which the schema
    // comparison above cannot see, because it only ever compares the row to
    // itself.
    expect([...EVERY_ETAPE].sort()).toEqual([...ETAPES_THE_PIPELINE_DECLARES].sort())

    // Non-vacuity: a witness that named nothing would satisfy every comparison
    // above vacuously, so each is asserted to be a real vocabulary first.
    expect(ETAPES_THE_COLUMN_DECLARES.length).toBeGreaterThan(0)
    expect(DECISIONS_THE_COLUMN_DECLARES.length).toBeGreaterThan(0)
    expect(ETAPES_THE_PIPELINE_DECLARES.length).toBeGreaterThan(0)
  })

  it("carries the pipeline's vocabulary in both directions", () => {
    const etape: Etape = "DIRECTION_REVIEW"
    const decision: Decision = "WITHDRAWN"

    expect(acceptsEtape(etape)).toBe("DIRECTION_REVIEW")
    expect(acceptsDecision(decision)).toBe("WITHDRAWN")
  })
})
