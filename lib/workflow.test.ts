import { describe, it, expect } from "vitest"
import {
  toLegacyStatus,
  fromLegacyStatus,
  canTransition,
  buildTransition,
  getAllowedActions,
  canTransitionFromLegacy,
  buildTransitionFromLegacy,
} from "./workflow"

// ─── Legacy mappers ──────────────────────────────────────────────────────────

describe("toLegacyStatus", () => {
  it("maps DRAFT with PENDING to BROUILLON", () => {
    expect(toLegacyStatus("DRAFT", "PENDING")).toBe("BROUILLON")
  })

  it("maps MANAGER_REVIEW with PENDING to SOUMISE", () => {
    expect(toLegacyStatus("MANAGER_REVIEW", "PENDING")).toBe("SOUMISE")
  })

  it("maps MANAGER_REVIEW with APPROVED to APPROUVEE_MANAGER", () => {
    expect(toLegacyStatus("MANAGER_REVIEW", "APPROVED")).toBe("APPROUVEE_MANAGER")
  })

  it("maps MANAGER_REVIEW with REJECTED to REJETEE_MANAGER", () => {
    expect(toLegacyStatus("MANAGER_REVIEW", "REJECTED")).toBe("REJETEE_MANAGER")
  })

  it("maps FINANCE_REVIEW with PENDING to APPROUVEE_MANAGER", () => {
    expect(toLegacyStatus("FINANCE_REVIEW", "PENDING")).toBe("APPROUVEE_MANAGER")
  })

  it("maps FINANCE_REVIEW with APPROVED to APPROUVEE_FINANCE", () => {
    expect(toLegacyStatus("FINANCE_REVIEW", "APPROVED")).toBe("APPROUVEE_FINANCE")
  })

  it("maps FINANCE_REVIEW with REJECTED to REJETEE_FINANCE", () => {
    expect(toLegacyStatus("FINANCE_REVIEW", "REJECTED")).toBe("REJETEE_FINANCE")
  })

  it("maps DIRECTION_REVIEW with PENDING to APPROUVEE_FINANCE", () => {
    expect(toLegacyStatus("DIRECTION_REVIEW", "PENDING")).toBe("APPROUVEE_FINANCE")
  })

  it("maps DIRECTION_REVIEW with APPROVED to APPROUVEE", () => {
    expect(toLegacyStatus("DIRECTION_REVIEW", "APPROVED")).toBe("APPROUVEE")
  })

  it("maps DIRECTION_REVIEW with REJECTED to REJETEE_DIRECTION", () => {
    expect(toLegacyStatus("DIRECTION_REVIEW", "REJECTED")).toBe("REJETEE_DIRECTION")
  })

  it("maps FINAL with APPROVED to APPROUVEE", () => {
    expect(toLegacyStatus("FINAL", "APPROVED")).toBe("APPROUVEE")
  })

  it("maps WITHDRAWN with WITHDRAWN to RETIREE", () => {
    expect(toLegacyStatus("WITHDRAWN", "WITHDRAWN")).toBe("RETIREE")
  })

  it("maps REJECTED with any decision to REJETEE_DIRECTION (fallback)", () => {
    expect(toLegacyStatus("REJECTED", "REJECTED")).toBe("REJETEE_DIRECTION")
  })
})

describe("fromLegacyStatus", () => {
  it("maps BROUILLON to DRAFT+PENDING", () => {
    expect(fromLegacyStatus("BROUILLON")).toEqual({ etape: "DRAFT", decision: "PENDING" })
  })

  it("maps SOUMISE to MANAGER_REVIEW+PENDING", () => {
    expect(fromLegacyStatus("SOUMISE")).toEqual({ etape: "MANAGER_REVIEW", decision: "PENDING" })
  })

  it("maps APPROUVEE_MANAGER to FINANCE_REVIEW+PENDING", () => {
    expect(fromLegacyStatus("APPROUVEE_MANAGER")).toEqual({ etape: "FINANCE_REVIEW", decision: "PENDING" })
  })

  it("maps APPROUVEE_FINANCE to DIRECTION_REVIEW+PENDING", () => {
    expect(fromLegacyStatus("APPROUVEE_FINANCE")).toEqual({ etape: "DIRECTION_REVIEW", decision: "PENDING" })
  })

  it("maps APPROUVEE to FINAL+APPROVED", () => {
    expect(fromLegacyStatus("APPROUVEE")).toEqual({ etape: "FINAL", decision: "APPROVED" })
  })

  it("maps REJETEE_MANAGER to REJECTED+REJECTED", () => {
    expect(fromLegacyStatus("REJETEE_MANAGER")).toEqual({ etape: "REJECTED", decision: "REJECTED" })
  })

  it("maps REJETEE_FINANCE to REJECTED+REJECTED", () => {
    expect(fromLegacyStatus("REJETEE_FINANCE")).toEqual({ etape: "REJECTED", decision: "REJECTED" })
  })

  it("maps REJETEE_DIRECTION to REJECTED+REJECTED", () => {
    expect(fromLegacyStatus("REJETEE_DIRECTION")).toEqual({ etape: "REJECTED", decision: "REJECTED" })
  })

  it("maps RETIREE to WITHDRAWN+WITHDRAWN", () => {
    expect(fromLegacyStatus("RETIREE")).toEqual({ etape: "WITHDRAWN", decision: "WITHDRAWN" })
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
    expect(canTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "approuver")).toBe(true)
  })

  it("allows FINANCE_ADMIN to reject at FINANCE_REVIEW", () => {
    expect(canTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "rejeter")).toBe(true)
  })

  it("allows GENERAL_DIRECTION to approve at DIRECTION_REVIEW", () => {
    expect(canTransition("GENERAL_DIRECTION", "DIRECTION_REVIEW", "approuver")).toBe(true)
  })

  it("denies action on terminal FINAL stage", () => {
    expect(canTransition("GENERAL_DIRECTION", "FINAL", "approuver")).toBe(false)
  })

  it("denies action on terminal REJECTED stage", () => {
    expect(canTransition("MANAGER", "REJECTED", "rejeter")).toBe(false)
  })

  it("denies action on terminal WITHDRAWN stage", () => {
    expect(canTransition("EMPLOYEE", "WITHDRAWN", "submit")).toBe(false)
  })
})

// ─── buildTransition (Etape-based) ───────────────────────────────────────────

describe("buildTransition", () => {
  it("returns transition for EMPLOYEE submitting from DRAFT", () => {
    const result = buildTransition("EMPLOYEE", "DRAFT", "submit")
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("SOUMISSION")
    expect(result!.notificationEvent).toBe("DEMANDE_SOUMISE")
    expect(result!.transition.newStatus).toBe("SOUMISE")
    expect(result!.transition.fields).toHaveProperty("statut", "SOUMISE")
    expect(result!.transition.fields).toHaveProperty("soumiseLe")
  })

  it("returns transition for MANAGER approving", () => {
    const result = buildTransition("MANAGER", "MANAGER_REVIEW", "approuver", {
      comment: "Looks good",
      assigneAId: "user-2",
    })
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("APPROBATION_MANAGER")
    expect(result!.transition.newStatus).toBe("APPROUVEE_MANAGER")
    expect(result!.transition.fields).toHaveProperty("commentaireManager", "Looks good")
    expect(result!.transition.fields).toHaveProperty("assigneAId", "user-2")
  })

  it("returns transition for MANAGER rejecting", () => {
    const result = buildTransition("MANAGER", "MANAGER_REVIEW", "rejeter", {
      comment: "Denied",
    })
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("REJET")
    expect(result!.notificationEvent).toBe("DEMANDE_REJETEE")
    expect(result!.transition.newStatus).toBe("REJETEE_MANAGER")
  })

  it("returns transition for FINANCE_ADMIN approving", () => {
    const result = buildTransition("FINANCE_ADMIN", "FINANCE_REVIEW", "approuver", {
      comment: "Budget OK",
    })
    expect(result).not.toBeNull()
    expect(result!.transition.newStatus).toBe("APPROUVEE_FINANCE")
    expect(result!.transition.fields).toHaveProperty("commentaireFinance", "Budget OK")
  })

  it("returns transition for GENERAL_DIRECTION approving to terminal", () => {
    const result = buildTransition("GENERAL_DIRECTION", "DIRECTION_REVIEW", "approuver", {
      comment: "Final approval",
    })
    expect(result).not.toBeNull()
    expect(result!.transition.newStatus).toBe("APPROUVEE")
    expect(result!.notificationEvent).toBe("DEMANDE_APPROBATION_FINALE")
  })

  it("returns transition for EMPLOYEE withdrawing from DRAFT", () => {
    const result = buildTransition("EMPLOYEE", "DRAFT", "retirer")
    expect(result).not.toBeNull()
    expect(result!.auditAction).toBe("RETRAIT")
    expect(result!.transition.newStatus).toBe("RETIREE")
  })

  it("returns null for wrong role on a stage", () => {
    expect(buildTransition("EMPLOYEE", "MANAGER_REVIEW", "approuver")).toBeNull()
  })

  it("returns null for unsupported action on a stage", () => {
    expect(buildTransition("MANAGER", "MANAGER_REVIEW", "submit")).toBeNull()
  })

  it("returns null for action on terminal stage", () => {
    expect(buildTransition("GENERAL_DIRECTION", "FINAL", "approuver")).toBeNull()
  })

  it("returns null for withdraw on non-DRAFT stage", () => {
    expect(buildTransition("EMPLOYEE", "MANAGER_REVIEW", "retirer")).toBeNull()
  })
})

// ─── Legacy wrappers ─────────────────────────────────────────────────────────

describe("canTransitionFromLegacy", () => {
  it("accepts StatutDemande instead of Etape", () => {
    expect(canTransitionFromLegacy("MANAGER", "SOUMISE", "approuver")).toBe(true)
  })

  it("denies wrong role with StatutDemande", () => {
    expect(canTransitionFromLegacy("EMPLOYEE", "SOUMISE", "approuver")).toBe(false)
  })

  it("allows submit from BROUILLON for EMPLOYEE", () => {
    expect(canTransitionFromLegacy("EMPLOYEE", "BROUILLON", "submit")).toBe(true)
  })
})

describe("buildTransitionFromLegacy", () => {
  it("accepts StatutDemande and produces transition", () => {
    const result = buildTransitionFromLegacy("MANAGER", "SOUMISE", "approuver", {
      comment: "OK",
      assigneAId: "user-2",
    })
    expect(result).not.toBeNull()
    expect(result!.transition.newStatus).toBe("APPROUVEE_MANAGER")
  })

  it("returns null for unsupported legacy status+role combo", () => {
    expect(buildTransitionFromLegacy("EMPLOYEE", "SOUMISE", "approuver")).toBeNull()
  })
})

// ─── getAllowedActions ───────────────────────────────────────────────────────

describe("getAllowedActions", () => {
  const makeDemande = (statut: string, employeId: string) => ({
    statut,
    employeId,
  })

  it("employee can submit and withdraw a BROUILLON demande they own", () => {
    const actions = getAllowedActions("EMPLOYEE", "user-1", makeDemande("BROUILLON", "user-1"))
    expect(actions.canSubmit).toBe(true)
    expect(actions.canWithdraw).toBe(true)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })

  it("employee cannot act on a BROUILLON demande they do not own", () => {
    const actions = getAllowedActions("EMPLOYEE", "user-1", makeDemande("BROUILLON", "user-2"))
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("manager can approve and reject a SOUMISE demande", () => {
    const actions = getAllowedActions("MANAGER", "user-2", makeDemande("SOUMISE", "user-1"))
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("finance can approve and reject an APPROUVEE_MANAGER demande", () => {
    const actions = getAllowedActions("FINANCE_ADMIN", "user-3", makeDemande("APPROUVEE_MANAGER", "user-1"))
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("direction can approve and reject an APPROUVEE_FINANCE demande", () => {
    const actions = getAllowedActions("GENERAL_DIRECTION", "user-4", makeDemande("APPROUVEE_FINANCE", "user-1"))
    expect(actions.canApprove).toBe(true)
    expect(actions.canReject).toBe(true)
  })

  it("no actions allowed on terminal APPROUVEE demande", () => {
    const actions = getAllowedActions("GENERAL_DIRECTION", "user-4", makeDemande("APPROUVEE", "user-1"))
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
  })

  it("no actions allowed on RETIREE demande", () => {
    const actions = getAllowedActions("EMPLOYEE", "user-1", makeDemande("RETIREE", "user-1"))
    expect(actions.canSubmit).toBe(false)
    expect(actions.canWithdraw).toBe(false)
    expect(actions.canApprove).toBe(false)
    expect(actions.canReject).toBe(false)
  })
})
