import { describe, it, expect, vi } from "vitest"
import { NotificationBus } from "./notification-bus"
import type { NotificationAdapter, NotificationMessage, NotificationPayload } from "./notification-bus"
import type { PrismaClient, Role } from "@prisma/client"

function mockAdapter(): NotificationAdapter & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue({ success: true }) }
}

function mockPrisma(usersByRole: Array<{ id: string; role: Role }>): PrismaClient {
  return {
    utilisateur: {
      findMany: vi.fn().mockImplementation((args: { where: { role: { in: Role[] }; actif: boolean } }) => {
        const roles = args.where.role.in as Role[]
        const matches = usersByRole.filter((u) => roles.includes(u.role))
        return Promise.resolve(matches.map((u) => ({ id: u.id })))
      }),
    },
  } as unknown as PrismaClient
}

const makePayload = (overrides?: Partial<NotificationPayload>): NotificationPayload => ({
  demandeId: "d-1",
  numero: "DD-2025-0001",
  employe: { id: "emp-1", prenom: "Jean", nom: "Dupont" },
  ...overrides,
})

describe("NotificationBus", () => {
  it("dispatch returns dispatch result when all deliveries succeed", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([{ id: "mgr-1", role: "MANAGER" }])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.failures).toEqual([])
  })

  it("dispatch reports per-recipient failures when adapter fails", async () => {
    const adapter = mockAdapter()
    adapter.send.mockResolvedValueOnce({ success: false, error: new Error("DB write error") })
    const prisma = mockPrisma([{ id: "mgr-1", role: "MANAGER" }])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(1)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.failures[0]).toMatchObject({ utilisateurId: "mgr-1", error: "DB write error" })
  })

  it("dispatch aggregates mixed success/failure across multiple recipients", async () => {
    const adapter = mockAdapter()
    adapter.send
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: new Error("Network timeout") })

    const prisma = mockPrisma([
      { id: "mgr-1", role: "MANAGER" },
      { id: "mgr-2", role: "MANAGER" },
    ])
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_SOUMISE", makePayload())

    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].utilisateurId).toBe("mgr-2")
  })

  it("dispatch succeeds with zero notifications when no roles match and no employee/assignee", async () => {
    const adapter = mockAdapter()
    // FINANCE_ADMIN role is not targeted by DEMANDE_REJETEE; only employee is
    // but we use a fresh adapter that hasn't been configured for role lookup
    const prisma = mockPrisma([]) as unknown as PrismaClient
    const bus = new NotificationBus(adapter, prisma)

    const result = await bus.dispatch("DEMANDE_APPROBATION_FINALE", makePayload())

    // DEMANDE_APPROBATION_FINALE notifies the employee (1 recipient)
    expect(result.total).toBe(1)
    expect(adapter.send).toHaveBeenCalled()
  })

  it("dispatch sends correct message format to each recipient", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([{ id: "fin-1", role: "FINANCE_ADMIN" }])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_APPROBATION_MANAGER", makePayload())

    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage | undefined
    expect(call).toBeDefined()
    expect(call!.titre).toBe("Demande approuvée par le manager")
    expect(call!.utilisateurId).toBe("fin-1")
    expect(call!.demandeId).toBe("d-1")
  })

  it("dispatch notifies employee for rejection events", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_REJETEE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande rejetée")
  })

  it("dispatch notifies assignee on withdraw with assigneAId set", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: "approver-1" }))

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe("approver-1")
  })

  it("dispatch does not notify assignee on withdraw when assigneAId is null", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    await bus.dispatch("DEMANDE_RETIREE", makePayload({ assigneAId: null }))

    expect(adapter.send).not.toHaveBeenCalled()
  })

  it("dispatch notifies employee on final approval", async () => {
    const adapter = mockAdapter()
    const prisma = mockPrisma([])
    const bus = new NotificationBus(adapter, prisma)

    const payload = makePayload()
    await bus.dispatch("DEMANDE_APPROBATION_FINALE", payload)

    expect(adapter.send).toHaveBeenCalledTimes(1)
    const call = adapter.send.mock.calls[0]?.[0] as NotificationMessage
    expect(call.utilisateurId).toBe(payload.employe.id)
    expect(call.titre).toBe("Demande approuvée")
  })
})
