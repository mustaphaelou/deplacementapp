import { describe, it, expect, vi } from "vitest"
import { AuditBus } from "./audit-bus"
import type { AuditEvent } from "./audit-bus"
import type { PrismaClient } from "@prisma/client"

function mockPrisma(createImpl?: ReturnType<typeof vi.fn>): PrismaClient {
  return {
    journalAudit: {
      create: createImpl ?? vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  } as unknown as PrismaClient
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
    const create = vi.fn().mockResolvedValue({ id: "audit-1" })
    const prisma = mockPrisma(create)
    const bus = new AuditBus(prisma)

    await bus.log(makeEvent())

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      data: {
        utilisateurId: "u-1",
        action: "CREATION_UTILISATEUR",
        entite: "Utilisateur",
        entiteId: "entity-1",
        details: '{"email":"test@example.com"}',
      },
    })
  })

  it("persists an audit event without optional fields", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-2" })
    const prisma = mockPrisma(create)
    const bus = new AuditBus(prisma)

    await bus.log({
      utilisateurId: "u-2",
      action: "SUPPRESSION",
      entite: "VehiculeEntreprise",
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        utilisateurId: "u-2",
        action: "SUPPRESSION",
        entite: "VehiculeEntreprise",
        entiteId: null,
        details: null,
      },
    })
  })

  it("throws when prisma write fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("DB connection lost"))
    const prisma = mockPrisma(create)
    const bus = new AuditBus(prisma)

    await expect(bus.log(makeEvent())).rejects.toThrow("DB connection lost")
  })
})
