# DemandeDeployment — Candidate Repository Port Interfaces

Derived from the existing `DemandeQueries`, `DemandeFactory`, and `DemandeWorkflow` classes in `lib/`.

## 1. DemandeQueryPort

```typescript
import type { StatutDemande } from "@prisma/client"
import type { DashboardDemandeSummary } from "./dashboard"
import type { DemandeWithRelations, DemandeFindByIdInclude, DemandeFindByIdExtra } from "./demande-queries"
import { DemandeNotFoundError } from "./errors"

export type OrderByTimestamp = { column: TimestampColumn; direction: "asc" | "desc" }

export interface DemandeExportRow {
  numero: string
  destination: string
  dateDepart: Date
  dateRetour: Date
  typeTransport: string
  totalEstime: number | null
  statut: string
  creeLe: Date
  employe: { prenom: string; nom: string } | null
}

export type DemandeQueryParams = {
  page: number
  limit: number
  statut?: string
  recherche?: string
}

export interface DemandeQueryPort {
  findById(id: string): Promise<DemandeWithRelations>
  findById<I extends DemandeFindByIdInclude>(
    id: string,
    options: { include: I }
  ): Promise<DemandeWithRelations & DemandeFindByIdExtra<I>>

  findMany(
    role: string,
    userId: string,
    params: DemandeQueryParams
  ): Promise<{ demandes: DashboardDemandeSummary[]; total: number }>

  findByEmployeeId(
    userId: string,
    limit?: number
  ): Promise<DashboardDemandeSummary[]>

  findByStatuts(
    statuts: StatutDemande[],
    opts?: { limit?: number; includeEmployee?: boolean; orderBy?: OrderByTimestamp }
  ): Promise<DashboardDemandeSummary[]>

  countByStatut(
    statut: StatutDemande,
    userId?: string
  ): Promise<number>

  aggregateBudget(
    statuts: StatutDemande[]
  ): Promise<number>

  findAllForExport(): Promise<DemandeExportRow[]>
}
```

| Method | Accepts | Returns | Throws |
|---|---|---|---|
| `findById` | `(id: string)` or `(id: string, { include: I })` | `DemandeWithRelations` or `DemandeWithRelations & DemandeFindByIdExtra<I>` | `DemandeNotFoundError` when the record is not found or soft-deleted |
| `findMany` | `(role: string, userId: string, params: DemandeQueryParams)` | `{ demandes: DashboardDemandeSummary[]; total: number }` | — |
| `findByEmployeeId` | `(userId: string, limit?: number)` | `DashboardDemandeSummary[]` | — |
| `findByStatuts` | `(statuts: StatutDemande[], opts?: { limit?, includeEmployee?, orderBy? })` | `DashboardDemandeSummary[]` | — |
| `countByStatut` | `(statut: StatutDemande, userId?: string)` | `number` | — |
| `aggregateBudget` | `(statuts: StatutDemande[])` | `number` | — |
| `findAllForExport` | `()` | `DemandeExportRow[]` | — |

**Errors:** `DemandeNotFoundError` is thrown from `findById` only (checked `demande.deletedAt`). The other methods silently return empty results.

## 2. DemandeFactoryPort

```typescript
import type { CreateDemandeData } from "./demande-utils"
import type { Actor, DemandeWithRelations } from "./demande-types"
import type { PrismaTransactionClient } from "./prisma" // ad-hoc; no such type exists yet
import { UnauthorizedActionError, InvalidTransitionError } from "./errors"

export interface DemandeFactoryPort {
  createDraft(
    data: CreateDemandeData,
    actor: Actor,
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>

  createAndSubmit(
    data: CreateDemandeData,
    actor: Actor,
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}
```

| Method | Accepts | Returns | Throws |
|---|---|---|---|
| `createDraft` | `(data: CreateDemandeData, actor: Actor, tx?: PrismaTransactionClient)` | `{ demande: DemandeWithRelations }` | `UnauthorizedActionError` if the actor's user record is not found |
| `createAndSubmit` | `(data: CreateDemandeData, actor: Actor, tx?: PrismaTransactionClient)` | `{ demande: DemandeWithRelations }` | `UnauthorizedActionError` or `InvalidTransitionError` if the DRAFT→submit transition fails (should never happen, but guarded) |

**Notes:**
- Both methods delegate to the private `createDemande(data, actor, submit)`. The `submit` boolean controls whether to apply the `submit` workflow transition and dispatch a `SOUMISSION` audit event + `DEMANDE_SOUMISE` notification.
- `createAndSubmit` throws `InvalidTransitionError` if `buildTransition("EMPLOYEE", "DRAFT", "submit")` returns `null`.
- The current implementation's return type is `Promise<{ demande: … }>` where `demande` is the raw Prisma-created `DemandeDeplacement` record (not `DemandeWithRelations` with joined relations). The port interface above uses `DemandeWithRelations` as the ideal output, matching the richer shape callers likely expect.

## 3. DemandeWorkflowPort

```typescript
import type { PrismaTransactionClient } from "./prisma" // ad-hoc; no such type exists yet
import type { Actor } from "./demande-types"
import {
  DemandeNotFoundError,
  UnauthorizedActionError,
  InvalidTransitionError,
} from "./errors"

export interface DemandeWorkflowPort {
  executeTransition(
    params: {
      demandeId: string
      action: "submit" | "approuver" | "rejeter" | "retirer"
      actor: Actor
      comment?: string
    },
    tx?: PrismaTransactionClient
  ): Promise<{ demande: DemandeWithRelations }>
}
```

| Method | Accepts | Returns | Throws |
|---|---|---|---|
| `executeTransition` | `({ demandeId, action, actor, comment? }, tx?)` | `{ demande: DemandeWithRelations }` | `DemandeNotFoundError` if not found or soft-deleted; `UnauthorizedActionError` if the actor's role cannot perform the action on the current status, or if `retirer`/`submit` is attempted by non-owner; `InvalidTransitionError` if the transition effect is not defined |

**Errors (in detail):**
- `DemandeNotFoundError` — record missing or `deletedAt` is non-null
- `UnauthorizedActionError("Seul le proprietaire peut …")` — non-owner tries `submit` or `retirer`
- `UnauthorizedActionError()` — `canTransition` returns false for the role/etape/action
- `InvalidTransitionError()` — `buildTransition` returns null despite `canTransition` passing (safety net)

## Notes

### Redundancies / consolidation opportunities

- **`findById` overloads:** The overloaded `findById` (plain vs. with `include`) adds complexity. The `include` variant exists solely to eager-load `documents`. Consider a dedicated `findByIdWithDocuments` method instead.
- **`findMany` vs `findByEmployeeId` vs `findByStatuts`:** These three read methods overlap. `findMany` with a role filter subsumes `findByEmployeeId` (when `role === "EMPLOYEE"`). `findByStatuts` duplicates the statut-filtering logic in `findMany`. Consider a single flexible `findMany` with a richer params object.
- **`findAllForExport`** returns a different shape (`DemandeExportRow`) and is the only method that doesn't paginate. It could be extracted into a dedicated export port.
- **`createDraft` / `createAndSubmit`** share ~95% of their implementation. The port interface could expose a single `create(data, actor, submit?: boolean)` but the current design intentionally separates the two intents.

### Prisma-specific types leaking into the interface

| Type | Source | Why it leaks |
|---|---|---|
| `StatutDemande` | `@prisma/client` enum | Enum string union used in query filters. Could be replaced by a domain `DemandeStatus` type. |
| `DemandeWithRelations` | `@prisma/client` types + local picks | Built on `DemandeDeplacement` (Prisma model). Directly extends `DemandeDeplacement & { … }`. A pure-domain `Demande` entity would break this coupling. |
| `DemandeFindByIdInclude` / `DemandeFindByIdExtra` | `demande-queries.ts` | Built around Prisma's `Document` model. |
| `DashboardDemandeSummary` | `dashboard.ts` | A read-model shape referencing Prisma field types (e.g. `statut: string` instead of `StatutDemande`). |
| `DemandeExportRow` | `demande-queries.ts` | Same — tightly coupled to the Prisma field set. |
| `TypeTransport` | `@prisma/client` enum | Leaks into `CreateDemandeData`. |

A future pure-domain-entity effort should introduce:
- `type DemandeStatus = "DRAFT" | "SUBMITTED" | "MANAGER_APPROVED" | …` (already partially present as `Etape` + `Decision` in `workflow.ts`)
- A `Demande` domain entity with `id`, `numero`, `status`, `employeId`, `destination`, etc. (no Prisma decorators)
- A `CreateDemandeCommand` value object to replace `CreateDemandeData`
- Repository adapter methods to map between domain entities and Prisma models

### Transaction passthrough convention

- **Currently absent:** None of the three classes accept an optional `tx?: PrismaTransactionClient` parameter. When a Prisma `$transaction` is used, the `PrismaClient` is passed at construction time, not per-call.
- **Proposed convention:** Each write method in the factory and workflow ports should accept an **optional last parameter** `tx?: PrismaTransactionClient`. If provided, all Prisma operations inside the method use `tx` instead of `this.db`. This enables the service layer to batch writes in a single transaction.
- **Challenge:** The current code relies on `this.db` (the injected `PrismaClient` instance). Switching to an optional `tx` param requires every Prisma call to be gated: `const db = tx ?? this.db`. This is mechanical but tedious.
- **Query methods** (`findById`, `findMany`, etc.) could also accept `tx?` for consistency (e.g. inside a transaction you may want to read and write), but are omitted above since they are read-only.
- **`PrismaTransactionClient`** does not exist in this codebase yet. It is the inferred type of the callback argument to `prisma.$transaction((tx) => …)`. A future implementation would need to extract or alias it.
