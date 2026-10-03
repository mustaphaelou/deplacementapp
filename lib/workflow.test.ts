import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import {
  canTransition,
  buildTransition,
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
} from "./workflow"
import type { Role } from "./auth"
import { TOUS_LES_ROLES } from "./auth"

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

  // The accessor and the collection must not drift: if they did, a link built
  // from one and a count summed over the other would disagree — the exact shape
  // of the defect this accessor's existence is meant to make impossible.
  it("names the same Etape the collection holds, for every Role", () => {
    for (const role of TOUS_LES_ROLES) {
      expect(queueEtape(role), role).toBe(queueEtapes(role)[0])
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

  it("follows the pipeline: changing the declared lane changes the link", () => {
    // THE PROPERTY THIS TICKET BUYS, demonstrated rather than asserted in
    // prose. The link is computed from `PIPELINE_VIEWS` at call time, so a
    // lane the declaration carries cannot produce a link naming the old one.
    // Before this composition existed, a rename left six hand-typed URLs
    // pointing at a lane that no longer existed.
    for (const role of TOUS_LES_ROLES) {
      expect(lienFileAttente(role)).toContain(`etape=${PIPELINE_VIEWS[role].queue[0]}`)
      expect(lienFileAttente(role)).toContain(`etape=${queueEtape(role)}`)
    }
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

// ─── canTransition (Etape-based) ─────────────────────────────────────────────

describe("canTransition", () => {
  it("allows EMPLOYEE to submit from DRAFT", () => {
    expect(canTransition("EMPLOYEE", "DRAFT", "submit")).toBe(true)
  })

  it("denies MANAGER from submitting", () => {
    expect(canTransition("MANAGER", "DRAFT", "submit")).toBe(false)
  })

  it("allows EMPLOYEE to withdraw from DRAFT", () => {
    expect(canTransition("EMPLOYEE", "DRAFT", "retirer")).toBe(true)
  })

  it("denies EMPLOYEE from withdrawing after submission", () => {
    expect(canTransition("EMPLOYEE", "MANAGER_REVIEW", "retirer")).toBe(false)
  })

  it("allows MANAGER to approve at MANAGER_REVIEW", () => {
    expect(canTransition("MANAGER", "MANAGER_REVIEW", "approuver")).toBe(true)
  })

  it("allows MANAGER to reject at MANAGER_REVIEW", () => {
    expect(canTransition("MANAGER", "MANAGER_REVIEW", "rejeter")).toBe(true)
  })

  it("denies EMPLOYEE from approving at MANAGER_REVIEW", () => {
    expect(canTransition("EMPLOYEE", "MANAGER_REVIEW", "approuver")).toBe(false)
  })

  it("allows FINANCE_ADMIN to approve at FINANCE_REVIEW", () => {
    expect(canTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "approuver")).toBe(
      true
    )
  })

  it("allows FINANCE_ADMIN to reject at FINANCE_REVIEW", () => {
    expect(canTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "rejeter")).toBe(
      true
    )
  })

  it("allows GENERAL_DIRECTION to approve at DIRECTION_REVIEW", () => {
    expect(
      canTransition("GENERAL_DIRECTION", "DIRECTION_REVIEW", "approuver")
    ).toBe(true)
  })

  it("denies action on terminal FINAL stage", () => {
    expect(canTransition("GENERAL_DIRECTION", "FINAL", "approuver")).toBe(false)
  })

  it("denies action on a stage with REJECTED decision", () => {
    expect(
      canTransition("MANAGER", "MANAGER_REVIEW", "rejeter", "REJECTED")
    ).toBe(false)
  })

  it("denies action on a stage with WITHDRAWN decision", () => {
    expect(canTransition("EMPLOYEE", "DRAFT", "submit", "WITHDRAWN")).toBe(
      false
    )
  })

  // CONTEXT.md — Decision: APPROVED, REJECTED, and WITHDRAWN are terminal;
  // once recorded, the DemandeDeplacement cannot transition, be edited, or be
  // resubmitted. A final-approved demande (Etape FINAL + Decision APPROVED)
  // freezes for every role and every action.
  it.each([
    ["EMPLOYEE", "DRAFT", "submit"],
    ["EMPLOYEE", "DRAFT", "retirer"],
    ["MANAGER", "MANAGER_REVIEW", "approuver"],
    ["FINANCE_ADMIN", "FINANCE_REVIEW", "rejeter"],
    ["GENERAL_DIRECTION", "DIRECTION_REVIEW", "approuver"],
  ] as const)(
    "denies %s from acting with %s on a demande whose Decision is APPROVED",
    (role, etape, action) => {
      expect(canTransition(role, etape, action, "APPROVED")).toBe(false)
      expect(
        buildTransition(role, etape, action, { decision: "APPROVED" })
      ).toBeNull()
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

// ─── buildTransition (Etape-based) ───────────────────────────────────────────

describe("buildTransition", () => {
  it("returns transition for EMPLOYEE submitting from DRAFT", () => {
    const result = buildTransition("EMPLOYEE", "DRAFT", "submit")
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("SOUMISSION")
    expect(result!.notificationEvent).toBe("DEMANDE_SOUMISE")
    expect(result!.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(result!.transition.newDecision).toBe("PENDING")
    expect(result!.transition.fields).toHaveProperty("etape", "MANAGER_REVIEW")
    expect(result!.transition.fields).toHaveProperty("soumiseLe")
  })

  it("returns transition for MANAGER approving", () => {
    const result = buildTransition("MANAGER", "MANAGER_REVIEW", "approuver", {
      comment: "Looks good",
      actorId: "user-2",
    })
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("APPROBATION_MANAGER")
    expect(result!.transition.newEtape).toBe("FINANCE_REVIEW")
    expect(result!.transition.fields).toHaveProperty(
      "commentaireManager",
      "Looks good"
    )
    expect(result!.transition.fields).toHaveProperty("assigneAId", "user-2")
  })

  it("returns transition for MANAGER rejecting", () => {
    const result = buildTransition("MANAGER", "MANAGER_REVIEW", "rejeter", {
      comment: "Denied",
      actorId: "user-2",
    })
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("REJET")
    expect(result!.notificationEvent).toBe("DEMANDE_REJETEE")
    expect(result!.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(result!.transition.newDecision).toBe("REJECTED")
    expect(result!.transition.fields).toHaveProperty("assigneAId", "user-2")
  })

  it("returns transition for FINANCE_ADMIN approving", () => {
    const result = buildTransition(
      "FINANCE_ADMIN",
      "FINANCE_REVIEW",
      "approuver",
      {
        comment: "Budget OK",
      }
    )
    expect(result).not.toBeNull()
    expect(result!.transition.newEtape).toBe("DIRECTION_REVIEW")
    expect(result!.transition.fields).toHaveProperty(
      "commentaireFinance",
      "Budget OK"
    )
  })

  it("returns transition for GENERAL_DIRECTION approving to terminal", () => {
    const result = buildTransition(
      "GENERAL_DIRECTION",
      "DIRECTION_REVIEW",
      "approuver",
      {
        comment: "Final approval",
      }
    )
    expect(result).not.toBeNull()
    expect(result!.transition.newEtape).toBe("FINAL")
    expect(result!.transition.newDecision).toBe("APPROVED")
    expect(result!.notificationEvent).toBe("DEMANDE_APPROBATION_FINALE")
  })

  it("returns transition for EMPLOYEE withdrawing from DRAFT", () => {
    const result = buildTransition("EMPLOYEE", "DRAFT", "retirer")
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("RETRAIT")
    expect(result!.transition.newEtape).toBe("DRAFT")
    expect(result!.transition.newDecision).toBe("WITHDRAWN")
  })

  it("returns null for wrong role on a stage", () => {
    expect(
      buildTransition("EMPLOYEE", "MANAGER_REVIEW", "approuver")
    ).toBeNull()
  })

  it("returns null for unsupported action on a stage", () => {
    expect(buildTransition("MANAGER", "MANAGER_REVIEW", "submit")).toBeNull()
  })

  it("returns null for action on terminal stage", () => {
    expect(
      buildTransition("GENERAL_DIRECTION", "FINAL", "approuver")
    ).toBeNull()
  })

  it("returns null for withdraw on non-DRAFT stage", () => {
    expect(buildTransition("EMPLOYEE", "MANAGER_REVIEW", "retirer")).toBeNull()
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
  // The case the old shape could not express. `buildTransition` had no way to
  // say « this actor does not own the row »: ownership was hardcoded to « yes »
  // inside it, so `buildTransition("EMPLOYEE","DRAFT","submit", {actorId:
  // "someone-else"})` returned a transition and claimed nothing about who the
  // actor was. Here the same question is asked with the fact stated, and the
  // guard's answer is a refusal with a reason on it.
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
// ONE call refuses or yields correctly at every tuple, that the reader and the
// writer both reach it, and that the creation projection is its own shadow.

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

  // The creation path's projection is a shadow of the one call, never a second
  // opinion: it states ownership by birth, so its answer is the owner-side
  // answer at every tuple, and it is null exactly where the guard refuses.
  it("leaves buildTransition as its own shadow: the owner-side answer, or null", () => {
    sweep((role, etape, action, decision, _ownerMatch) => {
      const built = buildTransition(role, etape, action, { decision })
      const ownerSide = resoudreTransition(role, etape, action, {
        decision,
        ownerMatch: true,
      })

      expect(built !== null, `${role}/${etape}/${action}/${String(decision)}`)
        .toBe(ownerSide.ok)
      if (!ownerSide.ok) expect(built).toBeNull()
    })
  })

  // canTransition stays the cheap owner-neutral QUERY — it is how a caller asks
  // « can I? » without building anything — and it must never become a way to
  // obtain a transition.
  it("leaves canTransition an owner-neutral query that yields nothing", () => {
    sweep((role, etape, action, decision, _ownerMatch) => {
      expect(canTransition(role, etape, action, decision)).toBe(
        checkTransition(role, etape, action, decision, true).ok
      )
    })
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

  it("keeps the creation path calling the builder it was written against", async () => {
    const source = await readFile(
      new URL("./workflow.ts", import.meta.url),
      "utf8"
    )
    const start = source.indexOf("export function etatCreation(")
    expect(start).toBeGreaterThan(-1)
    const creation = source.slice(start, source.indexOf("export function getAllowedActions("))

    // `etatCreation`'s call is untouched, and the builder it reaches still
    // exists and still returns nothing rather than throwing.
    expect(creation).toContain("buildTransition(")
    expect(creation).toContain("if (!transition) {")
    expect(source).toMatch(
      /export function buildTransition\([\s\S]*?\): WorkflowResult \| null/
    )
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
  const soumission = buildTransition(
    ouverture.roleCanAct as Role,
    ouverture.id,
    "submit"
  )

  it("exists in the pipeline: the opening Etape has a submit effect and a role that may act", () => {
    expect(ouverture.roleCanAct).toBeDefined()
    expect(effetSoumission).toBeDefined()
    expect(soumission).not.toBeNull()
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
      expect(etat.etape).toBe(soumission!.transition.newEtape)
      expect(etat.decision).toBe(soumission!.transition.newDecision)
      expect(etat.auditAction).toBe(soumission!.auditAction)
      expect(etat.notification).toBe(soumission!.notificationEvent)
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
