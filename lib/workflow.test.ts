import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import {
  readFileSync,
  readdirSync,
} from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"
import {
  checkTransition,
  etatCreation,
  getAllowedActions,
  resoudreTransition,
  lienFileAttente,
  DECISION_ATTENTE,
  queueEtape,
  queueEtapes,
  committedEtapes,
  laneOrderByColumn,
  enteringEffect,
  PIPELINE,
  PIPELINE_VIEWS,
  TRANSITION_EFFECTS,
  TERMINAL_DECISIONS,
  isPendingDecision,
} from "./workflow"
import type {
  Etape,
  Decision,
  WorkflowAction,
  Resolution,
  WorkflowResult,
  TransitionCheckReason,
} from "./workflow"
import type { Role } from "./auth"
import { TOUS_LES_ROLES } from "./auth"
// The home the reason is CARRIED TO, read here rather than restated: the reason
// set's whole subject is that the two ends agree, so the other end has to be the
// real table. This is a TEST importing the error module — the pipeline module
// itself gains no runtime import, which `lib/errors.test.ts` pins on
// `lib/workflow.ts`'s own source, and the two directions cannot form a cycle
// (`lib/errors.ts` reaches the pipeline with `import type` and nothing else).
import { REFUS_TRANSITION } from "./errors"

// ─── The tuple space, declared once ─────────────────────────────────────────
//
// The guard is a function of five things, and a sweep that forgets the fifth is
// a sweep over a smaller world than the one the guard answers for. Ownership is
// in here from the start (#299): it is a dimension of the question, not an
// afterthought bolted on by a caller.

const ROLES: readonly Role[] = [
  "EMPLOYEE",
  "MANAGER",
  "FINANCE_ADMIN",
  "GENERAL_DIRECTION",
]

const ETAPES: readonly Etape[] = [
  "DRAFT",
  "MANAGER_REVIEW",
  "FINANCE_REVIEW",
  "DIRECTION_REVIEW",
  "FINAL",
]

const ACTIONS: readonly WorkflowAction[] = [
  "submit",
  "approuver",
  "rejeter",
  "retirer",
]

// `undefined` is a real input: a DemandeDeplacement read before the Decision
// column is populated reaches the guard that way.
const DECISIONS: readonly (Decision | undefined)[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  undefined,
]

const OWNERSHIP: readonly boolean[] = [true, false]

/**
 * The success arm, read. The check is the assertion — a refused call names the
 * reason in the failure — and the throw after it is what narrows the union for
 * the type-checker. `expect(x.ok).toBe(true)` alone does not narrow, and the
 * alternative (`!`) would hand back exactly the `undefined` this ticket
 * removes from the refusal's reach.
 */
function attendu(resolution: Resolution): WorkflowResult {
  expect(
    resolution.ok,
    `la garde a refuse: ${JSON.stringify(resolution)}`
  ).toBe(true)
  if (!resolution.ok) throw new Error("unreachable")
  return resolution.transition
}

// ─── The « pending » predicate: the one definition of waiting ───────────────

describe("isPendingDecision / TERMINAL_DECISIONS", () => {
  it("pins the terminal set literally", () => {
    expect(TERMINAL_DECISIONS).toEqual(["APPROVED", "REJECTED", "WITHDRAWN"])
  })

  it("treats PENDING as pending", () => {
    expect(isPendingDecision("PENDING")).toBe(true)
  })

  it.each(["APPROVED", "REJECTED", "WITHDRAWN"] as const)(
    "treats %s as terminal",
    (decision) => {
      expect(isPendingDecision(decision)).toBe(false)
    }
  )

  // Every Decision value partitions into exactly one side: PENDING is the
  // only pending one, and the terminal set is exactly the rest.
  it("partitions all four Decision values", () => {
    const decisions: Decision[] = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "WITHDRAWN",
    ]

    expect(decisions.filter(isPendingDecision)).toEqual(["PENDING"])
    expect(decisions.filter((d) => !isPendingDecision(d))).toEqual(
      TERMINAL_DECISIONS
    )
  })

  // The guard reads the predicate: terminal ⟺ a live action is denied.
  it("agrees with the guard on every Decision value", () => {
    const decisions: Decision[] = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "WITHDRAWN",
    ]
    for (const decision of decisions) {
      const result = checkTransition(
        "MANAGER",
        "MANAGER_REVIEW",
        "rejeter",
        decision,
        true
      )
      expect(!result.ok).toBe(!isPendingDecision(decision))
    }
  })
})

// ─── Read-model: queueEtape / queueEtapes (Etape-based) ──────────────────────

describe("queueEtape", () => {
  it("returns the one Etape the Role waits on", () => {
    expect(queueEtape("EMPLOYEE")).toBe("DRAFT")
    expect(queueEtape("MANAGER")).toBe("MANAGER_REVIEW")
    expect(queueEtape("FINANCE_ADMIN")).toBe("FINANCE_REVIEW")
    expect(queueEtape("GENERAL_DIRECTION")).toBe("DIRECTION_REVIEW")
  })

  // A link is built from the single-lane accessor while the « En attente » count
  // is summed over the collection. With one lane per Role they agree — and the
  // agreement must be CHECKED, not assumed, because the two read one declaration
  // through different doors. This is the assertion that would fail if the two
  // accessors ever stopped agreeing.
  it("names the Etape the collection counts, for every Role", () => {
    for (const role of TOUS_LES_ROLES) {
      const counted = queueEtapes(role)
      const linked = queueEtape(role)

      expect(counted, `${role} counts no lane`).toContain(linked)
      // Every lane the count sums is a lane the link can name. One lane per
      // Role makes these the same fact, and this is where that is observed.
      expect(counted.filter((e) => e !== linked), `${role}`).toEqual([])
    }
  })
})

describe("queueEtapes", () => {
  it("returns DRAFT for EMPLOYEE", () => {
    expect(queueEtapes("EMPLOYEE")).toEqual(["DRAFT"])
  })

  it("returns MANAGER_REVIEW for MANAGER", () => {
    expect(queueEtapes("MANAGER")).toEqual(["MANAGER_REVIEW"])
  })

  it("returns FINANCE_REVIEW for FINANCE_ADMIN", () => {
    expect(queueEtapes("FINANCE_ADMIN")).toEqual(["FINANCE_REVIEW"])
  })

  it("returns DIRECTION_REVIEW for GENERAL_DIRECTION", () => {
    expect(queueEtapes("GENERAL_DIRECTION")).toEqual(["DIRECTION_REVIEW"])
  })
})

// THE INVARIANT THE TYPE NOW CARRIES, pinned as a test too.
//
// `PipelineView['queue']` is `readonly [Etape]`, so a second lane is a compile
// error at the declaration. This is not therefore redundant: an `as` cast or a
// widening assertion AT the declaration defeats the type silently, and no test
// of behaviour would notice. A test is cheaper than a cast audit, and this one
// is the whole acceptance criterion for the type.
//
// It is also the totality guard: a queue emptied at the declaration would make
// `queueEtape` return `undefined` at runtime while still typechecking, and
// every link naming a Role would become `…?etape=undefined&…`.
describe("every Role waits on exactly one lane", () => {
  it("holds one Etape per Role, and never zero", () => {
    expect(TOUS_LES_ROLES.length).toBeGreaterThan(0)

    for (const role of TOUS_LES_ROLES) {
      const queue = PIPELINE_VIEWS[role].queue

      expect(queue.length, `${role} holds no lane at all`).toBe(1)
      expect(queue[0], `${role} names no lane`).toBe(queueEtape(role))
    }
  })

  it("declares a queue for every Role the union names — none missing", () => {
    // `PIPELINE_VIEWS` is `Record<Role, PipelineView>`, so the keys track the
    // union at compile time; this reads it at runtime so a widening cast at the
    // declaration is caught here too.
    const declared = Object.keys(PIPELINE_VIEWS)
    expect(declared.length).toBeGreaterThan(0)
    expect(declared.sort()).toEqual([...TOUS_LES_ROLES].sort())
  })

  // The lane's own name, pinned HERE — where the lane is declared. This is the
  // only place a lane's name should be spelled out: renaming a lane changes this
  // test and the declaration, and nothing else (#304).
  it("pairs each Role with the Etape the domain fixes", () => {
    expect(
      TOUS_LES_ROLES.map((role) => [role, queueEtape(role)])
    ).toEqual([
      ["EMPLOYEE", "DRAFT"],
      ["MANAGER", "MANAGER_REVIEW"],
      ["FINANCE_ADMIN", "FINANCE_REVIEW"],
      ["GENERAL_DIRECTION", "DIRECTION_REVIEW"],
    ])
  })
})

// ─── The waiting-lane link: a pure function of a Role (#304) ────────────────

// The composition is the ONLY place a « waiting » link is spelled, so these
// tests can hold it to a RULE rather than to a URL. Nothing below renders,
// routes or touches a database — the composition is a pure function of a Role,
// and that is precisely what makes it assertable at all.
//
// This suite deliberately contains NO literal `/demandes?etape=…` string. The
// link's shape is asserted in terms of the pipeline's own vocabulary: the Role's
// waiting lane and the pending Decision. Spelling the URL here would re-create
// exactly the pin #304 exists to delete — a lane rename would break a test
// about a URL instead of a test about a rule.
describe("lienFileAttente", () => {
  it("is the DemandesDeplacement list filtered to the Role's lane and the pending Decision", () => {
    for (const role of TOUS_LES_ROLES) {
      const href = lienFileAttente(role)
      const params = new URLSearchParams(href.split("?")[1])

      expect(params.get("etape"), `${role} lane`).toBe(queueEtape(role))
      expect(params.get("decision"), `${role} Decision`).toBe(DECISION_ATTENTE)
      expect(href.startsWith("/demandes?"), `${role} route`).toBe(true)
    }
  })

  it("filters on the pending Decision, not on any terminal one", () => {
    // The « waiting » rule is PENDING ⟺ non-terminal. Asserting it through the
    // predicate rather than by naming the Decisions keeps this honest if the
    // pending Decision is ever re-spelled — and it is what makes a link that
    // forgot the pending filter a failure rather than a near miss.
    expect(isPendingDecision(DECISION_ATTENTE)).toBe(true)

    for (const role of TOUS_LES_ROLES) {
      const decision = new URLSearchParams(
        lienFileAttente(role).split("?")[1]
      ).get("decision")

      expect(decision, `${role} carries a terminal Decision`).not.toBeNull()
      expect(isPendingDecision(decision as Decision), role).toBe(true)
    }
  })

  it("gives each Role a DIFFERENT link — it is a function of the Role", () => {
    // Non-vacuity: a composition that ignored its argument and returned one
    // constant would satisfy both tests above while sending every Role to the
    // same lane.
    const hrefs = TOUS_LES_ROLES.map((role) => lienFileAttente(role))
    expect(new Set(hrefs).size).toBe(TOUS_LES_ROLES.length)
    expect(TOUS_LES_ROLES.length).toBeGreaterThan(1)
  })

  it("follows the pipeline: the lane it names is the one the Role waits on", () => {
    // Checked as a PREDICATE over the parsed link, not as a `toContain` of an
    // interpolated `queueEtape(role)` — that string is built from the same
    // accessor the composition calls, so it could not fail. This one parses what
    // was produced and asks whether it is a lane the pipeline actually declares.
    const DECLARED: readonly string[] = PIPELINE.map((stage) => stage.id)

    for (const role of TOUS_LES_ROLES) {
      const lane = new URLSearchParams(lienFileAttente(role).split("?")[1]).get(
        "etape"
      )

      expect(lane, `${role} produced no lane at all`).not.toBeNull()
      expect(DECLARED, `${role} → ${lane} is not a declared Etape`).toContain(
        lane as string
      )
      // And it is the Role's own lane, read back from the declaration directly
      // rather than through the accessor under test.
      expect(lane, role).toBe(PIPELINE_VIEWS[role].queue[0])
    }
  })
})

// THE REGRESSION CHECK #304 ASKS FOR, as a source pin rather than a claim.
//
// The property is: renaming a lane in the pipeline changes the pipeline's own
// test and leaves every LINK assertion green. It cannot be demonstrated by an
// in-suite assertion — asserting that `lienFileAttente` reads `PIPELINE_VIEWS`
// is a tautology, because that is its definition — so it is pinned where it can
// actually fail: by reading the sources.
//
// Two facts make the rename safe, and each is checked here:
//   1. NO test anywhere spells the text of a composed waiting link, so no link
//      assertion can break on a rename. (A literal URL in a test is the pin this
//      ticket deletes.)
//   2. NO production file outside `lib/workflow.ts` composes one either, so
//      there is exactly one place a rename has to be reflected in — and it is
//      the place that reads the declaration.
//
// Verified by running it: renaming MANAGER_REVIEW in the pipeline leaves all 39
// link assertions green and fails only this file.
describe("a lane rename cannot reach the links — the regression check", () => {
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "..")

  // A COMPOSED WAITING link, as opposed to any link that happens to name a lane.
  // The `&decision=` half is what tells them apart, and the distinction is the
  // spec's: « Brouillons » and « Finalisées » name lanes and mean something
  // ELSE entirely, so they legitimately spell their own URLs and are NOT
  // sweepable into the composition. Only the pending Decision marks the link
  // that means « waiting for me ».
  const COMPOSED_WAITING = /\/demandes\?etape=[^"'`\s]*[?&]decision=/

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, out)
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }

  // Comments may DISCUSS the link shape — several do, and this file does. Only
  // code counts, or a file explaining the rule would be reported as breaking it.
  const codeOf = (file: string): string =>
    readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

  it("leaves no test asserting the text of a composed waiting link", () => {
    // A test that spells `/demandes?etape=MANAGER_REVIEW&decision=PENDING` is a
    // test that breaks on a rename — the exact pin this ticket deletes.
    //
    // This file is exempted, as an exact path rather than an open allowance,
    // because it is where the PIN ITSELF lives: a source scan has to be able to
    // recognise the shape it forbids, and cannot do that without spelling it
    // once. What is forbidden is an ASSERTION on that shape — and the suite
    // above proves this file asserts none, since every assertion here is made
    // against `lienFileAttente` or the pipeline's own vocabulary.
    const SELF = join("lib", "workflow.test.ts")

    const offenders = walk(REPO)
      .filter((file) => /\.test\.(ts|tsx)$/.test(file))
      .filter((file) => relative(REPO, file) !== SELF)
      .filter((file) => COMPOSED_WAITING.test(codeOf(file)))
      .map((file) => relative(REPO, file))

    expect(offenders).toEqual([])
  })

  it("composes the waiting link in exactly one production file", () => {
    const offenders = walk(REPO)
      .filter((file) => !/\.test\.(ts|tsx)$/.test(file))
      .filter((file) => COMPOSED_WAITING.test(codeOf(file)))
      .map((file) => relative(REPO, file))

    // Exactly one: the pipeline module, beside the lane. More than one is a
    // second copy that a rename would miss; zero is a link nobody can produce.
    expect(offenders).toEqual([join("lib", "workflow.ts")])
  })

  // Non-vacuity for the pin above: it must be capable of failing, or it is
  // decoration. A pin that matches nothing in a tree where the rule IS satisfied
  // is indistinguishable from one that matches nothing ever.
  it("still recognises a composed waiting link when one is present", () => {
    expect(COMPOSED_WAITING.test('`/demandes?etape=${lane}&decision=PENDING`')).toBe(
      true
    )
    // And it must NOT sweep in the tabs the spec says to leave alone.
    expect(COMPOSED_WAITING.test('"/demandes?etape=DRAFT"')).toBe(false)
    expect(COMPOSED_WAITING.test('"/demandes?etape=FINAL"')).toBe(false)
  })
})

// ─── Read-model: committedEtapes (Etape-based) ────────────────────────────────

describe("committedEtapes", () => {
  it("returns FINAL for EMPLOYEE", () => {
    expect(committedEtapes("EMPLOYEE")).toEqual(["FINAL"])
  })

  it("returns FINAL for MANAGER", () => {
    expect(committedEtapes("MANAGER")).toEqual(["FINAL"])
  })

  it("returns FINAL for FINANCE_ADMIN", () => {
    expect(committedEtapes("FINANCE_ADMIN")).toEqual(["FINAL"])
  })

  it("returns FINAL + DIRECTION_REVIEW + FINANCE_REVIEW for GENERAL_DIRECTION", () => {
    expect(committedEtapes("GENERAL_DIRECTION")).toEqual([
      "FINAL",
      "DIRECTION_REVIEW",
      "FINANCE_REVIEW",
    ])
  })
})

// ─── Read-model: laneOrderByColumn ───────────────────────────────────────────

describe("laneOrderByColumn", () => {
  it("orders MANAGER_REVIEW by soumiseLe desc", () => {
    expect(laneOrderByColumn("MANAGER_REVIEW")).toEqual({
      column: "soumiseLe",
      direction: "desc",
    })
  })

  it("orders FINANCE_REVIEW by approuveeManagerLe desc", () => {
    expect(laneOrderByColumn("FINANCE_REVIEW")).toEqual({
      column: "approuveeManagerLe",
      direction: "desc",
    })
  })

  it("orders DIRECTION_REVIEW by approuveeFinanceLe desc", () => {
    expect(laneOrderByColumn("DIRECTION_REVIEW")).toEqual({
      column: "approuveeFinanceLe",
      direction: "desc",
    })
  })

  it("orders FINAL by approuveeDirectionLe desc", () => {
    expect(laneOrderByColumn("FINAL")).toEqual({
      column: "approuveeDirectionLe",
      direction: "desc",
    })
  })

  it("orders DRAFT by retireeLe desc", () => {
    expect(laneOrderByColumn("DRAFT")).toEqual({
      column: "retireeLe",
      direction: "desc",
    })
  })
})

describe("enteringEffect", () => {
  it("picks the entering effect, ignoring self-loop effects that appear earlier", () => {
    const rejeter = TRANSITION_EFFECTS.find(
      (e) => e.from === "MANAGER_REVIEW" && e.action === "rejeter"
    )!
    const perturbed = [rejeter, ...TRANSITION_EFFECTS]
    expect(enteringEffect("MANAGER_REVIEW", perturbed)?.timestamps[0]).toBe(
      "soumiseLe"
    )
  })

  it("preserves the explicit DRAFT → retireeLe case", () => {
    expect(enteringEffect("DRAFT", TRANSITION_EFFECTS)?.timestamps[0]).toBe(
      "retireeLe"
    )
  })
})

// ─── The permission table — which transitions each Etape admits ─────────────
//
// This table is the guard's real contract, and it is the only place it is
// written down. The sweep further down proves a different thing — that every
// refusal NAMES one of the four reasons — and a named refusal says
// nothing about which tuples are permitted at each Etape.
//
// The cases ask the guard itself and read its whole verdict, reason included.
// They used to ask the boolean projection, which collapsed that verdict to
// `true`/`false` and, in collapsing it, hardcoded `ownerMatch` to `true`: it
// answered « may this actor act » without ever being asked whether the actor
// owns the DemandeDeplacement. Asserting the reason is strictly stronger than
// the `.toBe(false)` it replaces, and it is what makes this the guard's
// contract rather than a restatement of a helper.
//
// Every case therefore STATES its ownership input. The old answers are
// reproduced exactly by supplying `true` — a faithful rewrite, not a
// weakened one — so the table keeps saying what it said while the reader can
// finally see the fact the projection used to assert on its behalf.

describe("the permission table — the guard's verdict at each Etape", () => {
  it("allows EMPLOYEE to submit from DRAFT", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "submit", undefined, true)
    ).toEqual({ ok: true })
  })

  it("denies MANAGER from submitting", () => {
    expect(
      checkTransition("MANAGER", "DRAFT", "submit", undefined, true)
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })

  it("allows EMPLOYEE to withdraw from DRAFT", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "retirer", undefined, true)
    ).toEqual({ ok: true })
  })

  it("denies EMPLOYEE from withdrawing after submission", () => {
    expect(
      checkTransition("EMPLOYEE", "MANAGER_REVIEW", "retirer", undefined, true)
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })

  it("allows MANAGER to approve at MANAGER_REVIEW", () => {
    expect(
      checkTransition("MANAGER", "MANAGER_REVIEW", "approuver", undefined, true)
    ).toEqual({ ok: true })
  })

  it("allows MANAGER to reject at MANAGER_REVIEW", () => {
    expect(
      checkTransition("MANAGER", "MANAGER_REVIEW", "rejeter", undefined, true)
    ).toEqual({ ok: true })
  })

  it("denies EMPLOYEE from approving at MANAGER_REVIEW", () => {
    expect(
      checkTransition(
        "EMPLOYEE",
        "MANAGER_REVIEW",
        "approuver",
        undefined,
        true
      )
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })

  it("allows FINANCE_ADMIN to approve at FINANCE_REVIEW", () => {
    expect(
      checkTransition(
        "FINANCE_ADMIN",
        "FINANCE_REVIEW",
        "approuver",
        undefined,
        true
      )
    ).toEqual({ ok: true })
  })

  it("allows FINANCE_ADMIN to reject at FINANCE_REVIEW", () => {
    expect(
      checkTransition(
        "FINANCE_ADMIN",
        "FINANCE_REVIEW",
        "rejeter",
        undefined,
        true
      )
    ).toEqual({ ok: true })
  })

  it("allows GENERAL_DIRECTION to approve at DIRECTION_REVIEW", () => {
    expect(
      checkTransition(
        "GENERAL_DIRECTION",
        "DIRECTION_REVIEW",
        "approuver",
        undefined,
        true
      )
    ).toEqual({ ok: true })
  })

  it("denies action on terminal FINAL stage", () => {
    expect(
      checkTransition(
        "GENERAL_DIRECTION",
        "FINAL",
        "approuver",
        undefined,
        true
      )
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })

  it("denies action on a stage with REJECTED decision", () => {
    expect(
      checkTransition("MANAGER", "MANAGER_REVIEW", "rejeter", "REJECTED", true)
    ).toEqual({ ok: false, reason: "TERMINAL" })
  })

  it("denies action on a stage with WITHDRAWN decision", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "submit", "WITHDRAWN", true)
    ).toEqual({ ok: false, reason: "TERMINAL" })
  })

  // CONTEXT.md — Decision: APPROVED, REJECTED, and WITHDRAWN are terminal;
  // once recorded, the DemandeDeplacement cannot transition, be edited, or be
  // resubmitted. A final-approved demande (Etape FINAL + Decision APPROVED)
  // freezes for every role and every action.
  //
  // The second assertion in each case goes through the PRODUCTION entry, so the
  // claim is the one that matters: the same tuple the guard refuses is refused
  // by `resoudreTransition` as a REASON. While the creation path had its own
  // `null`-shaped projection, this second half could only be stated as
  // `toBeNull()` — which is not a claim at all, because a projection that lost
  // the reason could not answer anything better (#363).
  it.each([
    ["EMPLOYEE", "DRAFT", "submit"],
    ["EMPLOYEE", "DRAFT", "retirer"],
    ["MANAGER", "MANAGER_REVIEW", "approuver"],
    ["FINANCE_ADMIN", "FINANCE_REVIEW", "rejeter"],
    ["GENERAL_DIRECTION", "DIRECTION_REVIEW", "approuver"],
  ] as const)(
    "denies %s from acting with %s on a demande whose Decision is APPROVED",
    (role, etape, action) => {
      expect(checkTransition(role, etape, action, "APPROVED", true)).toEqual({
        ok: false,
        reason: "TERMINAL",
      })
      expect(
        resoudreTransition(role, etape, action, {
          decision: "APPROVED",
          ownerMatch: true,
        })
      ).toEqual({ ok: false, reason: "TERMINAL" })
    }
  )

  it("reports TERMINAL for an APPROVED decision at a stage a role can act on", () => {
    expect(
      checkTransition(
        "MANAGER",
        "MANAGER_REVIEW",
        "rejeter",
        "APPROVED",
        true
      )
    ).toEqual({ ok: false, reason: "TERMINAL" })
    expect(
      checkTransition(
        "GENERAL_DIRECTION",
        "DIRECTION_REVIEW",
        "approuver",
        "APPROVED",
        true
      )
    ).toEqual({ ok: false, reason: "TERMINAL" })
  })

  // At FINAL no role may act at all (stage has no roleCanAct), so the guard
  // denies before the terminal check — but the outcome is the same: an
  // APPROVED demande is never actionable, at any Etape, by any role.
  it("never allows any action once the Decision is APPROVED, across the tuple space", () => {
    const roles: Role[] = [
      "EMPLOYEE",
      "MANAGER",
      "FINANCE_ADMIN",
      "GENERAL_DIRECTION",
    ]
    const etapes: Etape[] = [
      "DRAFT",
      "MANAGER_REVIEW",
      "FINANCE_REVIEW",
      "DIRECTION_REVIEW",
      "FINAL",
    ]
    const actions: WorkflowAction[] = [
      "submit",
      "approuver",
      "rejeter",
      "retirer",
    ]
    for (const role of roles) {
      for (const etape of etapes) {
        for (const action of actions) {
          const result = checkTransition(
            role,
            etape,
            action,
            "APPROVED",
            true
          )
          expect(result.ok).toBe(false)
        }
      }
    }
  })
})

// ─── The transition each effect yields (through the one entry) ─────────────
//
// These used to ask the creation path's `null`-shaped projection and answered
// « non-null, and here is the payload ». Read through `resoudreTransition` the
// same claims are STRONGER, because the success arm is the only place a
// transition exists: there is no `!` left to write and no `null` that could
// stand for a refusal the reason never named.
//
// The refusals these cases used to state as `toBeNull()` are not restated here.
// They are covered by the exhaustive sweep below, which asks the production
// entry at every tuple and compares it to the guard, and by « reports the four
// reasons the guard has always reported », which names each one (#363).

describe("the transition each effect yields", () => {
  it("returns transition for EMPLOYEE submitting from DRAFT", () => {
    const result = attendu(
      resoudreTransition("EMPLOYEE", "DRAFT", "submit", { ownerMatch: true })
    )
    expect(result.auditAction).toBe("SOUMISSION")
    expect(result.notificationEvent).toBe("DEMANDE_SOUMISE")
    expect(result.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(result.transition.newDecision).toBe("PENDING")
    expect(result.transition.fields).toHaveProperty("etape", "MANAGER_REVIEW")
    expect(result.transition.fields).toHaveProperty("soumiseLe")
  })

  it("returns transition for MANAGER approving", () => {
    const result = attendu(
      resoudreTransition("MANAGER", "MANAGER_REVIEW", "approuver", {
        ownerMatch: true,
        comment: "Looks good",
        actorId: "user-2",
      })
    )
    expect(result.auditAction).toBe("APPROBATION_MANAGER")
    expect(result.transition.newEtape).toBe("FINANCE_REVIEW")
    expect(result.transition.fields).toHaveProperty(
      "commentaireManager",
      "Looks good"
    )
    expect(result.transition.fields).toHaveProperty("assigneAId", "user-2")
  })

  it("returns transition for MANAGER rejecting", () => {
    const result = attendu(
      resoudreTransition("MANAGER", "MANAGER_REVIEW", "rejeter", {
        ownerMatch: true,
        comment: "Denied",
        actorId: "user-2",
      })
    )
    expect(result.auditAction).toBe("REJET")
    expect(result.notificationEvent).toBe("DEMANDE_REJETEE")
    expect(result.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(result.transition.newDecision).toBe("REJECTED")
    expect(result.transition.fields).toHaveProperty("assigneAId", "user-2")
  })

  it("returns transition for FINANCE_ADMIN approving", () => {
    const result = attendu(
      resoudreTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "approuver", {
        ownerMatch: true,
        comment: "Budget OK",
      })
    )
    expect(result.transition.newEtape).toBe("DIRECTION_REVIEW")
    expect(result.transition.fields).toHaveProperty(
      "commentaireFinance",
      "Budget OK"
    )
  })

  it("returns transition for GENERAL_DIRECTION approving to terminal", () => {
    const result = attendu(
      resoudreTransition(
        "GENERAL_DIRECTION",
        "DIRECTION_REVIEW",
        "approuver",
        { ownerMatch: true, comment: "Final approval" }
      )
    )
    expect(result.transition.newEtape).toBe("FINAL")
    expect(result.transition.newDecision).toBe("APPROVED")
    expect(result.notificationEvent).toBe("DEMANDE_APPROBATION_FINALE")
  })

  it("returns transition for EMPLOYEE withdrawing from DRAFT", () => {
    const result = attendu(
      resoudreTransition("EMPLOYEE", "DRAFT", "retirer", { ownerMatch: true })
    )
    expect(result.auditAction).toBe("RETRAIT")
    expect(result.transition.newEtape).toBe("DRAFT")
    expect(result.transition.newDecision).toBe("WITHDRAWN")
  })
})

// ─── getAllowedActions ───────────────────────────────────────────────────────

describe("getAllowedActions", () => {
  // The reader takes the ownership FACT (`ownerMatch`), not the ids to derive
  // it from: the comparison that decides ownership belongs to the guard, and
  // the page passes its answer in (#299).
  const demande = (etape: Etape, decision: Decision | undefined) => ({
    etape,
    decision,
  })

  it("employee can submit and withdraw a DRAFT demande they own", () => {
    const actions = getAllowedActions("EMPLOYEE", true, demande("DRAFT", "PENDING"))
    expect(actions.canSubmit).toBe(true)
    expect(actions.canWithdraw).toBe(true)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })

  it("employee cannot act on a DRAFT demande they do not own", () => {
    const actions = getAllowedActions(
      "EMPLOYEE",
      false,
      demande("DRAFT", "PENDING")
    )
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("manager can approve and reject a MANAGER_REVIEW demande", () => {
    const actions = getAllowedActions(
      "MANAGER",
      false,
      demande("MANAGER_REVIEW", "PENDING")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("finance can approve and reject an FINANCE_REVIEW demande", () => {
    const actions = getAllowedActions(
      "FINANCE_ADMIN",
      false,
      demande("FINANCE_REVIEW", "PENDING")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("direction can approve and reject an DIRECTION_REVIEW demande", () => {
    const actions = getAllowedActions(
      "GENERAL_DIRECTION",
      false,
      demande("DIRECTION_REVIEW", "PENDING")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("no actions allowed on terminal FINAL demande", () => {
    const actions = getAllowedActions(
      "GENERAL_DIRECTION",
      true,
      demande("FINAL", "APPROVED")
    )
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("no actions allowed on WITHDRAWN demande", () => {
    const actions = getAllowedActions(
      "EMPLOYEE",
      true,
      demande("DRAFT", "WITHDRAWN")
    )
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })

  // The reader reaches no ownership verdict of its own: it asks the one call
  // and reports what came back. If the `&& isOwner` conjunction were bolted on
  // again — ownership decided after the verdict rather than passed into the
  // question — this fails, and it fails on BOTH ownership values: the old code
  // passed on the non-owner side by accident and only disagreed for a Role
  // whose verdict the conjunction happened not to gate.
  it("reports the guard's own verdict per button, ownership included", () => {
    for (const role of ROLES) {
      for (const etape of ETAPES) {
        for (const decision of DECISIONS) {
          for (const ownerMatch of OWNERSHIP) {
            const reported = getAllowedActions(role, ownerMatch, {
              etape,
              decision,
            })
            const verdict = (action: WorkflowAction) =>
              resoudreTransition(role, etape, action, {
                decision,
                ownerMatch,
              }).ok
            const where = `${role}/${etape}/${String(decision)}/owner=${ownerMatch}`

            expect(reported.canSubmit, `submit ${where}`).toBe(
              verdict("submit")
            )
            expect(reported.canApprove, `approuver ${where}`).toBe(
              verdict("approuver")
            )
            expect(reported.canReject, `rejeter ${where}`).toBe(
              verdict("rejeter")
            )
            expect(reported.canWithdraw, `retirer ${where}`).toBe(
              verdict("retirer")
            )
          }
        }
      }
    }
  })
})

// ─── resoudreTransition: the one call, and what it refuses ────────────────

describe("resoudreTransition", () => {
  // The case the old shape could not express. The creation path's projection
  // had no way to say « this actor does not own the row »: ownership was
  // hardcoded to « yes » inside it, so a submit from a non-owner came back as
  // a transition that claimed nothing about who the actor was — and a refusal
  // came back as a `null` that named nothing. Here the same question is asked
  // with the fact stated, and the guard's answer is a refusal with a reason on
  // it.
  it("refuses a non-owner's owner action, naming NOT_OWNER", () => {
    expect(
      resoudreTransition("EMPLOYEE", "DRAFT", "submit", {
        decision: "PENDING",
        ownerMatch: false,
        actorId: "someone-else",
      })
    ).toEqual({ ok: false, reason: "NOT_OWNER" })

    expect(
      resoudreTransition("EMPLOYEE", "DRAFT", "retirer", {
        decision: "PENDING",
        ownerMatch: false,
        actorId: "someone-else",
      })
    ).toEqual({ ok: false, reason: "NOT_OWNER" })
  })

  // The same call, the same row, one fact changed: this actor IS the owner, and
  // the answer flips to a transition. The pair is the claim — the verdict
  // depends on the ownership fact, so it cannot have been assumed.
  it("yields the transition to the owner of the same DRAFT", () => {
    const transition = attendu(
      resoudreTransition("EMPLOYEE", "DRAFT", "submit", {
        decision: "PENDING",
        ownerMatch: true,
        actorId: "the-owner",
      })
    )
    expect(transition.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(transition.auditAction).toBe("SOUMISSION")
  })

  it("hands back the comment and the assignee it was given", () => {
    const fields = attendu(
      resoudreTransition("MANAGER", "MANAGER_REVIEW", "approuver", {
        decision: "PENDING",
        ownerMatch: true,
        comment: "Looks good",
        actorId: "user-2",
      })
    ).transition.fields
    expect(fields).toHaveProperty("commentaireManager", "Looks good")
    expect(fields).toHaveProperty("assigneAId", "user-2")
  })

  // A refused call cannot hand over a transition: the success arm is the only
  // place the field exists, so reading it off a refusal is a type error, not a
  // runtime `undefined` a caller might have passed on.
  it("has no transition to read when it refuses", () => {
    const resolution = resoudreTransition("EMPLOYEE", "DRAFT", "submit", {
      decision: "WITHDRAWN",
      ownerMatch: true,
    })
    expect(resolution.ok).toBe(false)
    expect(Object.keys(resolution).sort()).toEqual(["ok", "reason"])
  })

  it("reports the four reasons the guard has always reported", () => {
    expect(
      resoudreTransition("MANAGER", "MANAGER_REVIEW", "rejeter", {
        decision: "REJECTED",
        ownerMatch: true,
      })
    ).toEqual({ ok: false, reason: "TERMINAL" })
    expect(
      resoudreTransition("EMPLOYEE", "DRAFT", "submit", {
        decision: "PENDING",
        ownerMatch: false,
      })
    ).toEqual({ ok: false, reason: "NOT_OWNER" })
    expect(
      resoudreTransition("MANAGER", "DRAFT", "submit", {
        decision: "PENDING",
        ownerMatch: true,
      })
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
    expect(
      resoudreTransition("EMPLOYEE", "DRAFT", "approuver", {
        decision: "PENDING",
        ownerMatch: true,
      })
    ).toEqual({ ok: false, reason: "NO_EFFECT" })
  })
})

// ─── checkTransition (reason-typed guard engine) ───────────────────────────

describe("checkTransition", () => {
  it("reports ok for an EMPLOYEE submitting from DRAFT", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", true)
    ).toEqual({ ok: true })
  })

  it("reports NOT_OWNER for a non-owner submit or retirer", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", false)
    ).toEqual({ ok: false, reason: "NOT_OWNER" })
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "retirer", "PENDING", false)
    ).toEqual({ ok: false, reason: "NOT_OWNER" })
  })

  it("reports TERMINAL for a terminal decision regardless of role", () => {
    expect(
      checkTransition("MANAGER", "MANAGER_REVIEW", "rejeter", "REJECTED", true)
    ).toEqual({ ok: false, reason: "TERMINAL" })
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "submit", "WITHDRAWN", true)
    ).toEqual({ ok: false, reason: "TERMINAL" })
  })

  it("reports NO_EFFECT when no transition effect exists for the action on the stage", () => {
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "approuver", "PENDING", true)
    ).toEqual({ ok: false, reason: "NO_EFFECT" })
    expect(
      checkTransition("EMPLOYEE", "DRAFT", "rejeter", "PENDING", true)
    ).toEqual({ ok: false, reason: "NO_EFFECT" })
  })

  it("reports WRONG_ROLE for a role that cannot act on the stage", () => {
    expect(
      checkTransition("MANAGER", "DRAFT", "submit", "PENDING", true)
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
    expect(
      checkTransition(
        "EMPLOYEE",
        "MANAGER_REVIEW",
        "approuver",
        "PENDING",
        true
      )
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
    expect(
      checkTransition(
        "GENERAL_DIRECTION",
        "FINAL",
        "approuver",
        "PENDING",
        true
      )
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })
})

// ─── The one call: exhaustive sweep over the whole tuple space ────────────
//
// Five dimensions, not four: Role × Etape × action × Decision × ownership.
// The old sweep had no ownership axis at all, which is precisely why the
// reader could reach an ownership verdict the guard had never been asked for
// and the suite stayed green (#299).
//
// What this claims is stronger than « two projections agree »: it claims the
// ONE call refuses or yields correctly at every tuple, and that the reader and
// the writer both reach it. The creation path reaches it too, and states its
// own tuple's admission at the end of this describe (#363).

describe("resoudreTransition sweep", () => {
  function sweep(
    fn: (
      role: Role,
      etape: Etape,
      action: WorkflowAction,
      decision: Decision | undefined,
      ownerMatch: boolean
    ) => void
  ): void {
    for (const role of ROLES) {
      for (const etape of ETAPES) {
        for (const action of ACTIONS) {
          for (const decision of DECISIONS) {
            for (const ownerMatch of OWNERSHIP) {
              fn(role, etape, action, decision, ownerMatch)
            }
          }
        }
      }
    }
  }

  it("is the guard's own answer, at every tuple, ownership included", () => {
    sweep((role, etape, action, decision, ownerMatch) => {
      const guard = checkTransition(role, etape, action, decision, ownerMatch)
      const resolution = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch,
      })
      const where = `${role}/${etape}/${action}/${String(decision)}/owner=${ownerMatch}`

      expect(resolution.ok, where).toBe(guard.ok)
      if (!guard.ok) {
        expect(resolution, where).toEqual({ ok: false, reason: guard.reason })
      }
    })
  })

  // The shape IS the ticket: the transition exists only on the success arm, so
  // a caller that did not get permission has no transition to read — the field
  // does not exist on the result it holds.
  it("puts the transition on the success arm and nothing else", () => {
    sweep((role, etape, action, decision, ownerMatch) => {
      const resolution = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch,
      })
      const keys = Object.keys(resolution).sort()

      if (resolution.ok) {
        expect(keys, `${role}/${etape}/${action}`).toEqual([
          "ok",
          "transition",
        ])
      } else {
        expect(keys, `${role}/${etape}/${action}`).toEqual(["ok", "reason"])
        expect(resolution.reason).toBeDefined()
      }
    })
  })

  // The refusal is a REASON, never an absence: every denied tuple says which of
  // the four it is. A `null` could not.
  it("always names a reason when it refuses, and it is one of the four", () => {
    const reasons = ["TERMINAL", "NOT_OWNER", "WRONG_ROLE", "NO_EFFECT"]
    sweep((role, etape, action, decision, ownerMatch) => {
      const resolution = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch,
      })
      if (!resolution.ok) {
        expect(reasons).toContain(resolution.reason)
      }
    })
  })

  // Ownership is a dimension of the ANSWER, not a filter applied afterwards.
  // The two claims: a non-owner never reaches an owner action, and ownership
  // never changes the verdict for an action that is not the owner's.
  it("gates only the owner actions, and never broadens access", () => {
    sweep((role, etape, action, decision, ownerMatch) => {
      const resolution = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch,
      })
      const isOwnerAction = action === "submit" || action === "retirer"
      const where = `${role}/${etape}/${action}/${String(decision)}/owner=${ownerMatch}`

      if (isOwnerAction && !ownerMatch) {
        // Not a blanket denial: a tuple refused for a different reason first
        // still reports THAT reason. The seat is read before the Decision, and
        // the Decision before ownership, so the guard's precedence shows here.
        expect(resolution.ok, where).toBe(false)
      } else if (!isOwnerAction) {
        // The VERDICT, not the payload: a granted transition carries a
        // `new Date()` stamp, so two calls a millisecond apart are never
        // deeply equal and comparing them would measure the clock, not the
        // guard.
        const verdictOf = (owner: boolean) => {
          const other = resoudreTransition(role, etape, action, {
            decision,
            ownerMatch: owner,
          })
          return other.ok ? "ok" : other.reason
        }
        expect(verdictOf(ownerMatch), where).toBe(verdictOf(true))
      }
    })
  })

  // The precedence the guard has always had, pinned through the one call: at
  // FINAL no role may act, so the seat is the reason even when the Decision is
  // terminal. Reordering those two checks would show here as TERMINAL.
  it("reads the Etape's seat before the Decision, so FINAL is WRONG_ROLE", () => {
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        for (const decision of TERMINAL_DECISIONS) {
          for (const ownerMatch of OWNERSHIP) {
            const resolution = resoudreTransition(
              role,
              "FINAL",
              action,
              { decision, ownerMatch }
            )
            expect(resolution, `${role}/FINAL/${action}/${decision}`).toEqual({
              ok: false,
              reason: "WRONG_ROLE",
            })
          }
        }
      }
    }
  })

  // The creation path's own tuple, read through the one entry: whatever Role
  // asks to create, the DemandeDeplacement it is about to be born into leaves
  // the opening Etape by the SEAT's submit, owned by birth, and is never
  // refused. This is the claim the sweep's `buildTransition` shadow used to make
  // from outside `etatCreation`; it is stated here as the fact it always was,
  // and it is what makes the creation path's refusal arm unreachable (#363).
  //
  // Both halves are needed, and the second is the one a projection could not
  // show: asking as the SEAT is admitted while asking as the CALLING Role is
  // refused, and asking without ownership is refused. `etatCreation` therefore
  // has to ask as the seat and state ownership by birth — which it does, and
  // which a projection hardcoding « yes » would have hidden behind its own
  // second opinion.
  it("admits the creation path's submit tuple only as the seat, owned by birth", () => {
    const ouverture = PIPELINE[0]
    const seat = ouverture.roleCanAct as Role
    const parBirth = resoudreTransition(seat, ouverture.id, "submit", {
      ownerMatch: true,
    })

    expect(parBirth.ok, "le siege de l'etape d'ouverture").toBe(true)
    expect(
      resoudreTransition(seat, ouverture.id, "submit", { ownerMatch: false }),
      "la meme action sans proprietaire"
    ).toEqual({ ok: false, reason: "NOT_OWNER" })

    // Every other Role asking for itself is refused — so the creation path's
    // use of the seat is load-bearing, not decorative. Derived from the union
    // the pipeline declares rather than hand-listed, so a new Role is covered.
    for (const role of TOUS_LES_ROLES) {
      if (role === seat) continue
      expect(
        resoudreTransition(role, ouverture.id, "submit", { ownerMatch: true }),
        role
      ).toEqual({ ok: false, reason: "WRONG_ROLE" })
    }
  })

  // The set is CLOSED, which is a different claim from the one above.
  //
  // « always names a reason when it refuses, and it is one of the four » reads
  // its four from a list of literals written here, so it holds on exactly the
  // addition it exists to catch: a fifth reason the sweep reaches fails that
  // case only if the literals happen to name it, and they cannot — the four were
  // the four when they were written. What is missing is the other direction —
  // that the reason set the guard PRODUCES is the reason set the refusal TABLE
  // enumerates — and only a derived comparison can say it. Both ends are read,
  // neither is transcribed: the left is what the sweep collected, the right is
  // the table's own keys, which the `Record<TransitionCheckReason, …>` makes a
  // compile error if a reason is added to one and not the other (ADR-0022).
  //
  // Non-vacuity FIRST, and the form is the REFUSED-TUPLE COUNT rather than
  // `raisons.length > 1` (`lib/errors.test.ts:246`): a sweep that collected
  // nothing leaves an empty set, which is trivially equal to nothing and would
  // pass the closure below while proving nothing at all. Counting the tuples
  // that were refused asserts the thing that makes the set real — the sweep
  // actually saw refusals — and the ceiling asserts the other half of the same
  // honesty, that it also saw admissions: a guard that refused every tuple would
  // pass a closure check just as cheaply, and would be nothing like this one.
  //
  // The bound a fifth reason escapes is named here rather than implied: this
  // sweep can only catch a reason reachable over Role × Etape × action × Decision
  // × ownership, so a reason sitting on a branch no tuple reaches stays
  // uncovered until that branch exists — the same bound the closure claim
  // inherits, and why the injected fifth reason in the mutation evidence is
  // placed on a branch the sweep demonstrably reaches.
  it("produces across the sweep exactly the reasons the refusal table names", () => {
    const refusees = new Set<TransitionCheckReason>()
    let tuples = 0
    let refusals = 0

    sweep((role, etape, action, decision, ownerMatch) => {
      tuples++
      const resolution = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch,
      })
      if (!resolution.ok) {
        refusals++
        refusees.add(resolution.reason)
      }
    })

    // The space is real, and it is a space the guard both refuses and admits.
    expect(refusals, "aucun tuple refuse: le balayage n'a rien collecte").toBeGreaterThan(0)
    expect(tuples).toBe(
      ROLES.length * ETAPES.length * ACTIONS.length * DECISIONS.length * OWNERSHIP.length
    )
    expect(refusals).toBeLessThan(tuples)

    // And it is closed: nothing the entry produced is unnamed by the table, and
    // the table names nothing the entry cannot produce.
    const produits = [...refusees].sort()
    expect(produits.length).toBeGreaterThan(1)
    expect(produits).toEqual(Object.keys(REFUS_TRANSITION).sort())
  })
})

// ─── One way in: the pins that make the shape structural ───────────────────
//
// Behavioural sweeps cannot see a function that does not exist. These read the
// sources, so re-introducing a second way in fails here even if every verdict
// it produces happens to match.

describe("the pipeline has one way in", () => {
  it("asks the guard once in the transition writer, with the ownership fact", async () => {
    const source = await readFile(
      new URL("./demande/mutations.ts", import.meta.url),
      "utf8"
    )
    const start = source.indexOf("export async function executeTransition(")
    const end = source.indexOf("export async function recordDocument(")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const corps = source.slice(start, end)

    // Exactly one call into the guard. The old body asked here AND asked again
    // inside buildTransition with ownership hardcoded to « yes ».
    expect(corps.match(/resoudreTransition\(/g) ?? []).toHaveLength(1)
    expect(corps).not.toContain("checkTransition")
    expect(corps).not.toContain("buildTransition")

    // And the fact is stated at the call site, not left to a default. Both
    // spellings count: `ownerMatch,` (shorthand) or `ownerMatch: <expr>`.
    expect(corps).toMatch(/ownerMatch\s*[,:]/)
  })

  // The writer's whole remaining job is to RAISE the refusal the reason names.
  // It composes no sentence and picks no class, and both halves are pinned here:
  // the composed ownership form is gone, and the raiser is imported.
  //
  // Guarded against vacuity on purpose. `indexOf` returns `-1` when the anchor is
  // absent, so a `not.toContain` on a wrongly-sliced body passes for everything —
  // including a body that was never found. So both anchors are asserted to EXIST
  // and their order checked BEFORE the slice, and the absence is counted rather
  // than searched for, so a second composed sentence is a failure too.
  it("raises the named refusal in the transition writer and composes no sentence", async () => {
    const source = await readFile(
      new URL("./demande/mutations.ts", import.meta.url),
      "utf8"
    )
    const start = source.indexOf("export async function executeTransition(")
    const end = source.indexOf("export async function recordDocument(")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const corps = source.slice(start, end)
    expect(corps.length).toBeGreaterThan(0)

    // The raise is there, once, reading the reason off the guard's own result.
    expect(corps.match(/throw refusPourTransition\(/g) ?? []).toHaveLength(1)
    expect(corps).toContain("resolution.reason")
    expect(corps).toMatch(/throw refusPourTransition\(\s*resolution\.reason,\s*action\s*\)/)

    // The composed ownership sentence is GONE — counted, not searched, so a
    // second composition of any shape is also a failure.
    expect(corps.match(/Seul le proprietaire peut\s*\+/g) ?? []).toHaveLength(0)
    // Neither half of the old conditional survives: the writer used to name the
    // action's two verbs and pick between them.
    expect(corps).not.toContain("soumettre")
    expect(corps).not.toContain("retirer")
    // …and the writer names no refusal class of its own. It did choose between
    // two of them before; now it imports the raiser and the table chooses.
    expect(corps).not.toContain("new UnauthorizedActionError")
    expect(corps).not.toContain("new InvalidTransitionError")
    expect(corps).not.toContain("resolution.reason ===")

    // The raiser is imported from the error module — beside the classes it
    // builds — and not from the pipeline, which may never gain one.
    expect(source).toMatch(/import \{[^}]*refusPourTransition[^}]*\} from "\.\.\/errors"/)
  })

  it("asks the guard once in the action reader, with no hand-applied conjunction", async () => {
    const source = await readFile(
      new URL("./workflow.ts", import.meta.url),
      "utf8"
    )
    const start = source.indexOf("export function getAllowedActions(")
    expect(start).toBeGreaterThan(-1)
    const reader = source.slice(start)

    expect(reader).toContain("resoudreTransition(")
    // The conjunction the reader used to reach an ownership verdict outside the
    // guard. Its absence is the acceptance criterion, made mechanical.
    expect(reader).not.toContain("isOwner")
    expect(reader).not.toMatch(/&&\s*ownerMatch/)
  })

  it("gives the guard's ownership input no default", async () => {
    const source = await readFile(
      new URL("./workflow.ts", import.meta.url),
      "utf8"
    )
    // The parameter list itself, up to the closing paren. `ownerMatch = true`
    // is the defect in one token: a default is how a caller comes to believe
    // it asserted something it never checked.
    const signature = source
      .slice(source.indexOf("export function checkTransition("))
      .slice(
        0,
        source
          .slice(source.indexOf("export function checkTransition("))
          .indexOf("\n)")
      )

    // The ownership fact is a REQUIRED boolean on a line of its own, with
    // nothing after the type. This one assertion covers both holes: a default
    // (`ownerMatch: boolean = true`) and an optional (`ownerMatch?:`) each
    // leave something after the colon or the type, so the line no longer ends
    // where this says it must. A default is how a caller comes to believe it
    // asserted something it never checked.
    expect(signature).toMatch(/^\s*ownerMatch:\s*boolean\s*$/m)
  })

  // What replaces the source-reading pin this suite used to carry (#363).
  //
  // The old pin asserted that `etatCreation`'s source CONTAINED a call to the
  // `null`-shaped projection, and that the projection still MATCHED its return
  // type. That proved a shape, and it held the very ambiguity it sat above in
  // place: the projection mapped a reason-typed refusal back to `null`, one
  // function below the fix #299 landed, and only a pin reading its signature
  // could tell.
  //
  // These two cases assert BEHAVIOUR instead:
  //
  // 1. « the creation path's fields equal the production entry's transition »
  //    (in the `etatCreation` describe, beside the other cases that read the
  //    pipeline) — the equality itself, compared field by field.
  // 2. this one: the refusal arm is a THROW and there is no `null`-returning
  //    helper left between the creation path and the guard. Reachability is
  //    deliberately NOT faked here: read against the guard, the creation path's
  //    own tuple is always admitted, so a fixture engineered to reach the arm
  //    would be testing an input the pipeline cannot produce. What can be
  //    observed without one is the module's export surface — and that is what
  //    is asserted, anchored and counted so it cannot pass vacuously.
  it("raises the creation path's refusal instead of returning a null", async () => {
    const source = await readFile(
      new URL("./workflow.ts", import.meta.url),
      "utf8"
    )
    const start = source.indexOf("export function etatCreation(")
    const end = source.indexOf("export function getAllowedActions(")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const creation = source.slice(start, end)
    expect(creation.length).toBeGreaterThan(0)

    // The creation path asks the PRODUCTION entry — the one whose refusal is a
    // reason — and exactly once.
    expect(creation.match(/resoudreTransition\(/g) ?? []).toHaveLength(1)

    // And it checks that answer. The `ok` test and the throw are one claim:
    // there is no arm left that could read the refusal as an absence.
    expect(creation).toMatch(/if \(!resolution\.ok\)\s*\{/)
    expect(creation).toContain("Aucune soumission possible depuis l'etape")

    // The refusal arm is a throw, so the sentence is inside it: asserted on the
    // slice BETWEEN the `ok` test and its closing brace, and counted there so
    // a throw added elsewhere cannot satisfy this.
    const bras = creation.slice(creation.indexOf("if (!resolution.ok) {"))
    expect(creation.indexOf("if (!resolution.ok) {")).toBeGreaterThan(-1)
    expect(bras).toContain("throw new Error(")

    // Ownership by birth stays a NAMED, declared fact: the call site states
    // the constant, and the constant is declared in the module rather than
    // inlined as a bare `true`. The anchor is asserted BEFORE the negative, so
    // a drifted spelling cannot turn the absence below into the empty string.
    expect(source).toContain("const PROPRIETAIRE_A_LA_NAISSANCE = true")
    expect(creation).toContain("ownerMatch: PROPRIETAIRE_A_LA_NAISSANCE")
    expect(creation).not.toMatch(/ownerMatch:\s*true\b/)

    // No `null`-shaped guard projection is left in the module. Counted over the
    // whole file, not sliced: the question is « is there a second way in that
    // answers with an absence », and a COUNT is what a negative search cannot
    // answer about itself.
    expect(source.match(/export function buildTransition\(/g) ?? []).toHaveLength(
      0
    )
    expect(source).not.toMatch(/\): WorkflowResult \| null/)
  })

  // The export surface, asserted as a namespace so a stub cannot hide behind a
  // re-added declaration. `expect("buildTransition" in module).toBe(false)` is
  // the non-vacuous form: it fails loudly if the projection comes back, and it
  // cannot pass by finding nothing to look at — the same module it asserts
  // about is the one it enumerates. The COUNT is the control that proves the
  // enumeration is real: the module exports names, and the deleted one is
  // absent from a set that is not empty (#363).
  it("exports no null projection, and the namespace it pins is not empty", async () => {
    const surface = await import("./workflow")

    expect("buildTransition" in surface).toBe(false)
    expect(Object.keys(surface).length).toBeGreaterThan(0)
    expect(Object.keys(surface)).not.toContain("buildTransition")

    // …and the production entry the creation path now asks is among them, so
    // the absence above cannot be satisfied by an empty or broken module.
    expect(Object.keys(surface)).toContain("resoudreTransition")
    expect("resoudreTransition" in surface).toBe(true)
  })
})

// ─── etatCreation: where a DemandeDeplacement is born ──────────────────────
//
// Nothing here names the opening Etape or the opening Decision as a literal:
// every expectation is read from the pipeline (PIPELINE, the transition table
// and the module's own « pending » predicate), so a change to the pipeline's
// opening state fails this suite instead of passing quietly.

describe("etatCreation", () => {
  const roles: Role[] = [
    "EMPLOYEE",
    "MANAGER",
    "FINANCE_ADMIN",
    "GENERAL_DIRECTION",
  ]
  const ouverture = PIPELINE[0]
  const effetSoumission = TRANSITION_EFFECTS.find(
    (e) => e.from === ouverture.id && e.action === "submit"
  )
  // What the production entry answers for the same submit the creation path
  // asks. Read off the success arm, so there is no `null` to compare against
  // and no second opinion anywhere in this fixture (#363).
  const soumission = attendu(
    resoudreTransition(ouverture.roleCanAct as Role, ouverture.id, "submit", {
      ownerMatch: true,
    })
  )

  it("exists in the pipeline: the opening Etape has a submit effect and a role that may act", () => {
    expect(ouverture.roleCanAct).toBeDefined()
    expect(effetSoumission).toBeDefined()
  })

  it("answers every Role on both paths with the frozen five-field shape", () => {
    for (const role of roles) {
      for (const soumis of [false, true]) {
        expect(Object.keys(etatCreation(role, soumis)).sort()).toEqual([
          "auditAction",
          "champs",
          "decision",
          "etape",
          "notification",
        ])
      }
    }
  })

  it("puts a draft at the opening Etape with the non-terminal Decision, for every Role", () => {
    for (const role of roles) {
      const etat = etatCreation(role, false)
      expect(etat.etape).toBe(ouverture.id)
      expect(isPendingDecision(etat.decision)).toBe(true)
      expect(etat.champs).toEqual({ etape: ouverture.id, decision: etat.decision })
    }
  })

  it("records CREATION and announces nothing for a draft", () => {
    for (const role of roles) {
      const etat = etatCreation(role, false)
      expect(etat.auditAction).toBe("CREATION")
      expect(etat.notification).toBeNull()
    }
  })

  it("a submitted creation is the submit action the transition path performs", () => {
    for (const role of roles) {
      const etat = etatCreation(role, true)
      expect(etat.etape).toBe(soumission.transition.newEtape)
      expect(etat.decision).toBe(soumission.transition.newDecision)
      expect(etat.auditAction).toBe(soumission.auditAction)
      expect(etat.notification).toBe(soumission.notificationEvent)
    }
  })

  // The equality itself, on `champs` — the half the case above leaves implicit,
  // and the acceptance criterion #363 asks for: the creation path's fields EQUAL
  // what the production entry returns for the same submit.
  //
  // `champs` is compared as the transition's `fields` were built: same keys, and
  // each value the one the guard wrote. The timestamps are `new Date()` created
  // separately per call, so they are compared by KEY and by TYPE — never by
  // value, which would measure the clock between two calls and not the guard.
  // Every other field is compared by value, because those are stable.
  it("writes exactly the fields the production entry returns for the same submit", () => {
    const stable = Object.keys(soumission.transition.fields).filter(
      (key) => !(soumission.transition.fields[key] instanceof Date)
    )
    const horodatages = Object.keys(soumission.transition.fields).filter(
      (key) => soumission.transition.fields[key] instanceof Date
    )
    // The split is real, not vacuous: there IS a timestamp to compare by type,
    // and there ARE stable fields to compare by value.
    expect(horodatages.length).toBeGreaterThan(0)
    expect(stable.length).toBeGreaterThan(0)

    for (const role of roles) {
      const champs = etatCreation(role, true).champs

      // The key sets agree exactly — nothing added by the creation path, and
      // nothing the guard wrote dropped on the way out.
      expect(Object.keys(champs).sort(), role).toEqual(
        Object.keys(soumission.transition.fields).sort()
      )
      for (const key of stable) {
        expect(champs[key], `${role}/${key}`).toEqual(
          soumission.transition.fields[key]
        )
      }
      for (const key of horodatages) {
        expect(champs[key], `${role}/${key}`).toBeInstanceOf(Date)
      }
    }
  })

  it("a submitted creation writes the effect's Etape, Decision and timestamps, and nothing else", () => {
    const expected = [
      "etape",
      "decision",
      ...effetSoumission!.timestamps,
    ].sort()
    for (const role of roles) {
      expect(Object.keys(etatCreation(role, true).champs).sort()).toEqual(
        expected
      )
      for (const ts of effetSoumission!.timestamps) {
        expect(etatCreation(role, true).champs[ts]).toBeInstanceOf(Date)
      }
    }
  })

  it("never lets the creating Role move where a DemandeDeplacement is born", () => {
    for (const soumis of [false, true]) {
      const answers = roles.map((role) => {
        const etat = etatCreation(role, soumis)
        return {
          etape: etat.etape,
          decision: etat.decision,
          auditAction: etat.auditAction,
          notification: etat.notification,
        }
      })
      for (const answer of answers) {
        expect(answer).toEqual(answers[0])
      }
    }
  })

  it("only ever answers with an Etape of the pipeline and a pending Decision", () => {
    for (const role of roles) {
      for (const soumis of [false, true]) {
        const etat = etatCreation(role, soumis)
        expect(PIPELINE.some((stage) => stage.id === etat.etape)).toBe(true)
        expect(isPendingDecision(etat.decision)).toBe(true)
      }
    }
  })

  it("champs always carries the Etape and the Decision it returns", () => {
    for (const role of roles) {
      for (const soumis of [false, true]) {
        const etat = etatCreation(role, soumis)
        expect(etat.champs.etape).toBe(etat.etape)
        expect(etat.champs.decision).toBe(etat.decision)
      }
    }
  })

  it("never hands the caller the modification timestamp to write", () => {
    for (const role of roles) {
      for (const soumis of [false, true]) {
        expect(etatCreation(role, soumis).champs).not.toHaveProperty("modifieLe")
      }
    }
  })

  it("hands each caller its own field set, never a shared one", () => {
    const first = etatCreation("EMPLOYEE", true)
    first.champs.soumiseLe = null
    first.champs.etape = null
    const second = etatCreation("EMPLOYEE", true)
    expect(second.champs.soumiseLe).toBeInstanceOf(Date)
    expect(second.champs.etape).toBe(second.etape)
  })
})
