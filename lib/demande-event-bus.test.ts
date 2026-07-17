import { describe, it, expect, vi } from "vitest"
import { DemandeEventBus } from "./demande-event-bus"
import type { DemandeEventParams } from "./demande-event-bus"
import type { NotificationBus } from "./notification-bus"
import type { AuditBus } from "./audit-bus"

function mockNotifications(): NotificationBus & { dispatch: ReturnType<typeof vi.fn> } {
  return {
    dispatch: vi.fn().mockResolvedValue({ total: 1, succeeded: 1, failed: 0, failures: [] }),
  } as unknown as NotificationBus & { dispatch: ReturnType<typeof vi.fn> }
}

function mockAudit(): AuditBus & { log: ReturnType<typeof vi.fn> } {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditBus & { log: ReturnType<typeof vi.fn> }
}

const makeParams = (overrides?: Partial<DemandeEventParams>): DemandeEventParams => ({
  utilisateurId: "u-1",
  action: "CREATION",
  entiteId: "dd-1",
  numero: "DD-2025-0001",
  notificationEvent: null,
  notificationPayload: null,
  ...overrides,
})

describe("DemandeEventBus", () => {
  it("dispatch calls audit.log with correct params", async () => {
    const notifications = mockNotifications()
    const audit = mockAudit()
    const bus = new DemandeEventBus(notifications, audit)

    await bus.dispatch(makeParams())

    expect(audit.log).toHaveBeenCalledTimes(1)
    expect(audit.log).toHaveBeenCalledWith({
      utilisateurId: "u-1",
      action: "CREATION",
      entite: "DemandeDeplacement",
      entiteId: "dd-1",
      details: { numero: "DD-2025-0001" },
    })
  })

  it("dispatch calls notifications.dispatch when notificationEvent and notificationPayload are provided", async () => {
    const notifications = mockNotifications()
    const audit = mockAudit()
    const bus = new DemandeEventBus(notifications, audit)

    await bus.dispatch(makeParams({
      notificationEvent: "DEMANDE_SOUMISE",
      notificationPayload: { employe: { id: "u-1", prenom: "Jean", nom: "Dupont" } },
    }))

    expect(notifications.dispatch).toHaveBeenCalledTimes(1)
    expect(notifications.dispatch).toHaveBeenCalledWith("DEMANDE_SOUMISE", {
      demandeId: "dd-1",
      numero: "DD-2025-0001",
      employe: { id: "u-1", prenom: "Jean", nom: "Dupont" },
    })
  })

  it("dispatch does not call notifications.dispatch when notificationEvent is null", async () => {
    const notifications = mockNotifications()
    const audit = mockAudit()
    const bus = new DemandeEventBus(notifications, audit)

    await bus.dispatch(makeParams({ notificationEvent: null, notificationPayload: null }))

    expect(notifications.dispatch).not.toHaveBeenCalled()
  })

  it("dispatch does not call notifications.dispatch when notificationPayload is null", async () => {
    const notifications = mockNotifications()
    const audit = mockAudit()
    const bus = new DemandeEventBus(notifications, audit)

    await bus.dispatch(makeParams({
      notificationEvent: "DEMANDE_SOUMISE",
      notificationPayload: null,
    }))

    expect(notifications.dispatch).not.toHaveBeenCalled()
  })

  it("dispatch does not call notifications.dispatch when notificationEvent is undefined", async () => {
    const notifications = mockNotifications()
    const audit = mockAudit()
    const bus = new DemandeEventBus(notifications, audit)

    await bus.dispatch(makeParams({ notificationEvent: undefined, notificationPayload: { employe: { id: "u-1", prenom: "Jean", nom: "Dupont" } } }))

    expect(notifications.dispatch).not.toHaveBeenCalled()
  })
})
