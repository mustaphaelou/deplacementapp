import { describe, it, expect, vi } from "vitest"
import { AuditBus } from "./audit-bus"
import type { AuditEvent } from "./audit-bus"

function mockDb() {
  const valuesFn = vi.fn()
  const insertFn = vi.fn(() => ({ values: valuesFn }))
  return { db: { insert: insertFn }, valuesFn }
}

const makeEvent = (overrides?: Partial<AuditEvent>): AuditEvent => ({
  utilisateurId: "u-1",
  action: "CREATION_UTILISATEUR",
  entite: "Utilisateur",
  entiteId: "entity-1",
  details: { email: "test@example.com" },
  ...overrides,
})

describe("AuditBus", () => {
  it("persists an audit event with all fields", async () => {
    const { db, valuesFn } = mockDb()
    const bus = new AuditBus(db as any)

    await bus.log(makeEvent())

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-1",
        action: "CREATION_UTILISATEUR",
        entite: "Utilisateur",
        entiteId: "entity-1",
        details: '{"email":"test@example.com"}',
      })
    )
  })

  it("persists an audit event without optional fields", async () => {
    const { db, valuesFn } = mockDb()

    const bus = new AuditBus(db as any)
    await bus.log({
      utilisateurId: "u-2",
      action: "SUPPRESSION",
      entite: "VehiculeEntreprise",
    })

    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: "u-2",
        action: "SUPPRESSION",
        entite: "VehiculeEntreprise",
        entiteId: null,
        details: null,
      })
    )
  })

  it("throws when db write fails", async () => {
    const valuesFn = vi.fn().mockRejectedValue(new Error("DB connection lost"))
    const db = { insert: vi.fn(() => ({ values: valuesFn })) }
    const bus = new AuditBus(db as any)

    await expect(bus.log(makeEvent())).rejects.toThrow("DB connection lost")
  })
})
