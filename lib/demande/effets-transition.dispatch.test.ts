import { describe, it, expect, vi, beforeEach } from "vitest"
import { appliquerEffets } from "./effets-transition"
import type { NotificationEventType } from "../notification"

vi.mock("../audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../notification", () => ({
  dispatchRows: vi.fn().mockResolvedValue(undefined),
}))

import { logAudit } from "../audit"
import { dispatchRows } from "../notification"

const mockedDispatchRows = vi.mocked(dispatchRows)
const mockedLogAudit = vi.mocked(logAudit)

const makeParams = () => ({
  audit: {
    utilisateurId: "u-1",
    action: "SOUMISSION",
    entiteId: "d-1",
    numero: "DD-2026-0001",
  },
  notification: {
    event: "DEMANDE_SOUMISE" as NotificationEventType,
    demandeId: "d-1",
    numero: "DD-2026-0001",
    employe: {
      id: "emp-1",
      prenom: "Jean",
      nom: "Dupont",
      departementId: "dept-1",
    },
    assigneAId: null as string | null,
  },
})

describe("appliquerEffets notification delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls dispatchRows(event, payload, tx) with the caller's transaction", async () => {
    const tx = { id: "tx-1" }
    await appliquerEffets(tx as any, makeParams())

    expect(mockedDispatchRows).toHaveBeenCalledTimes(1)
    const [event, payload, txArg] = mockedDispatchRows.mock.calls[0]
    expect(event).toBe("DEMANDE_SOUMISE")
    expect(payload).toEqual({
      demandeId: "d-1",
      numero: "DD-2026-0001",
      employe: {
        id: "emp-1",
        prenom: "Jean",
        nom: "Dupont",
        departementId: "dept-1",
      },
      assigneAId: null,
    })
    expect(txArg).toBe(tx)
  })

  it("does not call dispatchRows when notification param is null", async () => {
    const tx = { id: "tx-1" }
    await appliquerEffets(tx as any, {
      audit: {
        utilisateurId: "u-1",
        action: "CREATION",
        entiteId: "d-2",
        numero: "DD-2026-0002",
      },
      notification: null,
    })

    expect(mockedDispatchRows).not.toHaveBeenCalled()
  })

  it("passes no email through the transition path (rows-only invariant)", async () => {
    const tx = { id: "tx-1" }
    await appliquerEffets(tx as any, makeParams())

    expect(mockedDispatchRows).toHaveBeenCalledTimes(1)
    expect(mockedLogAudit).toHaveBeenCalledTimes(1)
  })
})
