import { describe, it, expect } from "vitest"
import {
  canTransition,
  buildTransition,
  checkTransition,
  getAllowedActions,
  queueEtapes,
  committedEtapes,
  rollupEtapes,
  laneOrderByColumn,
} from "./workflow"
import type { Etape, Decision, WorkflowAction } from "./workflow"
import type { Role } from "./auth"

// ─── Read-model: queueEtapes (Etape-based) ─────────────────────────────────────

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

// ─── Read-model: rollupEtapes (Etape-based) ───────────────────────────────────

describe("rollupEtapes", () => {
  it("returns DRAFT + MANAGER_REVIEW + FINAL for EMPLOYEE", () => {
    expect(rollupEtapes("EMPLOYEE")).toEqual([
      "DRAFT",
      "MANAGER_REVIEW",
      "FINAL",
    ])
  })

  it("returns MANAGER_REVIEW for MANAGER", () => {
    expect(rollupEtapes("MANAGER")).toEqual(["MANAGER_REVIEW"])
  })

  it("returns FINANCE_REVIEW for FINANCE_ADMIN", () => {
    expect(rollupEtapes("FINANCE_ADMIN")).toEqual(["FINANCE_REVIEW"])
  })

  it("returns DIRECTION_REVIEW for GENERAL_DIRECTION", () => {
    expect(rollupEtapes("GENERAL_DIRECTION")).toEqual(["DIRECTION_REVIEW"])
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
      assigneAId: "user-2",
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
    })
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("REJET")
    expect(result!.notificationEvent).toBe("DEMANDE_REJETEE")
    expect(result!.transition.newEtape).toBe("MANAGER_REVIEW")
    expect(result!.transition.newDecision).toBe("REJECTED")
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
  const makeDemande = (etape: string, decision: string, employeId: string) => ({
    etape: etape as import("./workflow").Etape,
    decision: decision as import("./workflow").Decision,
    employeId,
  })

  it("employee can submit and withdraw a DRAFT demande they own", () => {
    const actions = getAllowedActions(
      "EMPLOYEE",
      "user-1",
      makeDemande("DRAFT", "PENDING", "user-1")
    )
    expect(actions.canSubmit).toBe(true)
    expect(actions.canWithdraw).toBe(true)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })

  it("employee cannot act on a DRAFT demande they do not own", () => {
    const actions = getAllowedActions(
      "EMPLOYEE",
      "user-1",
      makeDemande("DRAFT", "PENDING", "user-2")
    )
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("manager can approve and reject a MANAGER_REVIEW demande", () => {
    const actions = getAllowedActions(
      "MANAGER",
      "user-2",
      makeDemande("MANAGER_REVIEW", "PENDING", "user-1")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("finance can approve and reject an FINANCE_REVIEW demande", () => {
    const actions = getAllowedActions(
      "FINANCE_ADMIN",
      "user-3",
      makeDemande("FINANCE_REVIEW", "PENDING", "user-1")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("direction can approve and reject an DIRECTION_REVIEW demande", () => {
    const actions = getAllowedActions(
      "GENERAL_DIRECTION",
      "user-4",
      makeDemande("DIRECTION_REVIEW", "PENDING", "user-1")
    )
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("no actions allowed on terminal FINAL demande", () => {
    const actions = getAllowedActions(
      "GENERAL_DIRECTION",
      "user-4",
      makeDemande("FINAL", "APPROVED", "user-1")
    )
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("no actions allowed on WITHDRAWN demande", () => {
    const actions = getAllowedActions(
      "EMPLOYEE",
      "user-1",
      makeDemande("DRAFT", "WITHDRAWN", "user-1")
    )
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })
})

// ─── checkTransition (reason-typed guard engine) ───────────────────────────

describe("checkTransition", () => {
  it("reports ok for an EMPLOYEE submitting from DRAFT", () => {
    expect(checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", true)).toEqual(
      { ok: true }
    )
  })

  it("reports NOT_OWNER for a non-owner submit or retirer", () => {
    expect(checkTransition("EMPLOYEE", "DRAFT", "submit", "PENDING", false)).toEqual(
      { ok: false, reason: "NOT_OWNER" }
    )
    expect(checkTransition("EMPLOYEE", "DRAFT", "retirer", "PENDING", false)).toEqual(
      { ok: false, reason: "NOT_OWNER" }
    )
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
    expect(checkTransition("MANAGER", "DRAFT", "submit", "PENDING", true)).toEqual(
      { ok: false, reason: "WRONG_ROLE" }
    )
    expect(
      checkTransition("EMPLOYEE", "MANAGER_REVIEW", "approuver", "PENDING", true)
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
    expect(
      checkTransition("GENERAL_DIRECTION", "FINAL", "approuver", "PENDING", true)
    ).toEqual({ ok: false, reason: "WRONG_ROLE" })
  })
})

// ─── Exhaustive sweep: one implementation, behavior locked ────────────────

describe("guard engine sweep", () => {
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
  const actions: WorkflowAction[] = ["submit", "approuver", "rejeter", "retirer"]
  const decisions: (Decision | undefined)[] = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
    undefined,
  ]

  it("canTransition and buildTransition never disagree", () => {
    for (const role of roles) {
      for (const etape of etapes) {
        for (const action of actions) {
          for (const decision of decisions) {
            for (const ownerMatch of [true, false]) {
              const viaCan = canTransition(role, etape, action, decision)
              const viaBuild =
                buildTransition(role, etape, action, { decision }) !== null
              expect({
                role,
                etape,
                action,
                decision,
                ownerMatch,
                allowed: viaCan,
              }).toEqual({
                role,
                etape,
                action,
                decision,
                ownerMatch,
                allowed: viaBuild,
              })
            }
          }
        }
      }
    }
  })

  it("both public functions are owner-neutral projections of checkTransition", () => {
    for (const role of roles) {
      for (const etape of etapes) {
        for (const action of actions) {
          for (const decision of decisions) {
            const check = checkTransition(role, etape, action, decision, true)
            expect(canTransition(role, etape, action, decision)).toBe(check.ok)
            expect(
              buildTransition(role, etape, action, { decision }) !== null
            ).toBe(check.ok)
          }
        }
      }
    }
  })
})
