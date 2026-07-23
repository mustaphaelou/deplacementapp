# DI Wiring Pattern — Proposal for Wiring the Three Repository Ports

## Current pattern summary

The codebase uses **manual constructor injection with module-level singletons**. Every service module:

1. Declares a class that receives its dependencies via the constructor (typically `PrismaClient` first, then optional cross-cutting concerns with defaults).
2. Imports the `prisma` singleton from `lib/prisma.ts` and other module-level singletons (e.g. `auditBus`, `notificationBus`, `demandeEventBus`, `defaultAvatarStorage`).
3. Exports a singleton constructed at the bottom of the module, e.g.:

```typescript
export const vehiculeService = new VehiculeService(prisma)
export const demandeService = new DemandeDeplacementService(prisma)
export const utilisateurService = new UtilisateurService(prisma)
```

Route handlers import these singletons and call methods on them.

### Key difference in `DemandeDeplacementService`

Unlike `UtilisateurService` and `VehiculeService` (which take all dependencies as constructor params), `DemandeDeplacementService` **internally instantiates** its three sub-components:

```typescript
// lib/demande-service.ts
constructor(db: PrismaClient, events: DemandeEventBus = demandeEventBus) {
  this.db = db
  this.queries = new DemandeQueries(db)
  this.factory = new DemandeFactory(db, events)
  this.workflow = new DemandeWorkflow(db, events)
}
```

This means:
- It is impossible to replace `DemandeQueries`, `DemandeFactory`, or `DemandeWorkflow` with mock/test doubles.
- The three sub-components share the same `PrismaClient` instance but can't participate in a Prisma `$transaction` that spans across them (no `tx` passthrough).
- The construction graph is hard-coded inside the constructor body.

---

## Proposed wiring module

Place a dedicated DI module at `lib/demande/di.ts` that:

1. Creates adapter instances that implement each port interface by wrapping the existing classes.
2. Constructs `DemandeDeplacementService` with constructor-injected ports instead of internally instantiating them.
3. Exports the singleton the rest of the app consumes.

### Step 1 — Refactor `DemandeDeplacementService` to accept ports

The service constructor changes from nested instantiation to explicit injection:

```typescript
// lib/demande-service.ts (refactored — constructor only)
export class DemandeDeplacementService {
  constructor(
    private db: PrismaClient,
    private queries: DemandeQueryPort,
    private factory: DemandeFactoryPort,
    private workflow: DemandeWorkflowPort,
    private events: DemandeEventBus = demandeEventBus
  ) {}

  // all methods remain identical — they already use this.queries, this.factory, this.workflow
}
```

### Step 2 — Port adapter implementations

Each adapter is a thin class that implements the port interface by delegating to the existing concrete class. The adapters live in `lib/demande/adapters/`.

```typescript
// lib/demande/adapters/prisma-demande-query-adapter.ts
import type { PrismaClient } from "@prisma/client"
import type { DemandeQueryPort } from "../ports/demande-query-port"
import { DemandeQueries } from "../../demande-queries"

export class PrismaDemandeQueryAdapter implements DemandeQueryPort {
  private inner: DemandeQueries

  constructor(db: PrismaClient) {
    this.inner = new DemandeQueries(db)
  }

  findById(id: string)                            { return this.inner.findById(id) }
  findById<I>(id: string, options: { include: I }) { return this.inner.findById(id, options) as any }
  findMany(role: string, userId: string, params: any) { return this.inner.findMany(role, userId, params) }
  findByEmployeeId(userId: string, limit?: number) { return this.inner.findByEmployeeId(userId, limit) }
  findByStatuts(statuts: any[], opts?: any)        { return this.inner.findByStatuts(statuts, opts) }
  countByStatut(statut: any, userId?: string)      { return this.inner.countByStatut(statut, userId) }
  aggregateBudget(statuts: any[])                  { return this.inner.aggregateBudget(statuts) }
  findAllForExport()                               { return this.inner.findAllForExport() }
}
```

```typescript
// lib/demande/adapters/prisma-demande-factory-adapter.ts
import type { PrismaClient } from "@prisma/client"
import type { DemandeEventBus } from "../../demande-event-bus"
import type { DemandeFactoryPort } from "../ports/demande-factory-port"
import { DemandeFactory } from "../../demande-factory"

export class PrismaDemandeFactoryAdapter implements DemandeFactoryPort {
  private inner: DemandeFactory

  constructor(db: PrismaClient, events: DemandeEventBus) {
    this.inner = new DemandeFactory(db, events)
  }

  createDraft(data: any, actor: any)    { return this.inner.createDraft(data, actor) as any }
  createAndSubmit(data: any, actor: any) { return this.inner.createAndSubmit(data, actor) as any }
}
```

```typescript
// lib/demande/adapters/prisma-demande-workflow-adapter.ts
import type { PrismaClient } from "@prisma/client"
import type { DemandeEventBus } from "../../demande-event-bus"
import type { DemandeWorkflowPort } from "../ports/demande-workflow-port"
import { DemandeWorkflow } from "../../demande-workflow"

export class PrismaDemandeWorkflowAdapter implements DemandeWorkflowPort {
  private inner: DemandeWorkflow

  constructor(db: PrismaClient, events: DemandeEventBus) {
    this.inner = new DemandeWorkflow(db, events)
  }

  executeTransition(params: any) { return this.inner.executeTransition(params) as any }
}
```

### Step 3 — The DI wiring module

```typescript
// lib/demande/di.ts — proposed
import { PrismaClient } from "@prisma/client"
import { prisma } from "../prisma"
import { demandeEventBus, DemandeEventBus } from "../demande-event-bus"
import { DemandeDeplacementService } from "../demande-service"
import { DemandeQueryPort } from "./ports/demande-query-port"
import { DemandeFactoryPort } from "./ports/demande-factory-port"
import { DemandeWorkflowPort } from "./ports/demande-workflow-port"
import { PrismaDemandeQueryAdapter } from "./adapters/prisma-demande-query-adapter"
import { PrismaDemandeFactoryAdapter } from "./adapters/prisma-demande-factory-adapter"
import { PrismaDemandeWorkflowAdapter } from "./adapters/prisma-demande-workflow-adapter"

// 1. Create port adapters
const demandeQueryAdapter: DemandeQueryPort      = new PrismaDemandeQueryAdapter(prisma)
const demandeFactoryAdapter: DemandeFactoryPort  = new PrismaDemandeFactoryAdapter(prisma, demandeEventBus)
const demandeWorkflowAdapter: DemandeWorkflowPort= new PrismaDemandeWorkflowAdapter(prisma, demandeEventBus)

// 2. Construct service with injected ports
export const demandeService = new DemandeDeplacementService(
  prisma,
  demandeQueryAdapter,
  demandeFactoryAdapter,
  demandeWorkflowAdapter,
  demandeEventBus
)
```

### Step 4 — How route handler imports change

**Before** (current):

```typescript
import { demandeService } from "../../lib/demande-service"
```

**After** (proposed):

```typescript
import { demandeService } from "../../lib/demande/di"
```

No other caller-side changes needed — the same `demandeService` name is exported with the same public API.

---

## Test wiring note

A test file creates `DemandeDeplacementService` with mock ports instead of real Prisma adapters. The mock pattern follows the **interface-based mock** approach (using Vitest or Jest):

```typescript
// tests/demande-service.test.ts
import { describe, it, expect, vi } from "vitest"
import { DemandeDeplacementService } from "../../lib/demande-service"
import type { DemandeQueryPort } from "../../lib/demande/ports/demande-query-port"
import type { DemandeFactoryPort } from "../../lib/demande/ports/demande-factory-port"
import type { DemandeWorkflowPort } from "../../lib/demande/ports/demande-workflow-port"
import { createMock } from "@total-typescript/shoehorn" // if used in project, else vi.mocked

function createMockPorts() {
  return {
    queries: {
      findById: vi.fn(),
      findMany: vi.fn(),
      findByEmployeeId: vi.fn(),
      findByStatuts: vi.fn(),
      countByStatut: vi.fn(),
      aggregateBudget: vi.fn(),
      findAllForExport: vi.fn(),
    } satisfies DemandeQueryPort,

    factory: {
      createDraft: vi.fn(),
      createAndSubmit: vi.fn(),
    } satisfies DemandeFactoryPort,

    workflow: {
      executeTransition: vi.fn(),
    } satisfies DemandeWorkflowPort,
  }
}

describe("DemandeDeplacementService", () => {
  it("delegates create to factory.createDraft", async () => {
    const ports = createMockPorts()
    const svc = new DemandeDeplacementService(
      {} as any,          // db — not used by executeAction paths that hit factory/workflow
      ports.queries,
      ports.factory,
      ports.workflow,
    )

    ports.factory.createDraft.mockResolvedValue({ demande: { id: "1" } })

    await svc.executeAction({
      action: "create",
      data: {} as any,
      actor: { id: "u1", role: "EMPLOYEE" },
    })

    expect(ports.factory.createDraft).toHaveBeenCalledOnce()
  })
})
```

No real database is needed. If a test wants to test the Prisma adapters against a real database, it can construct them directly:

```typescript
import { PrismaDemandeQueryAdapter } from "../../lib/demande/adapters/prisma-demande-query-adapter"
import { prisma } from "../../lib/prisma"

const adapter = new PrismaDemandeQueryAdapter(prisma)
const result = await adapter.findByEmployeeId("user-1")
```

This keeps integration tests explicit about what's being tested while unit tests stay fast and isolated.

---

## Consistency with existing patterns

| Aspect | Existing pattern | Proposed |
|---|---|---|
| Singleton export | Module-level `export const x = new X(...)` | Same — `lib/demande/di.ts` |
| Constructor injection | `UtilisateurService(db, audit?, avatarStorage?)` | Same — ports passed in constructor |
| Adapter pattern | `NotificationBus(adapter, db)` with `PrismaNotificationAdapter` | Same — each port has an adapter |
| Default params | `private audit = auditBus` | `events: DemandeEventBus = demandeEventBus` |
| Testability | `VehiculeService(db)` — hard to mock db | Port interfaces allow full mock isolation |
