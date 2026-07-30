# ADR 0011: Collapse AuditBus into a deep JournalAudit module

**Date:** 2026-07-30

**Status:** Accepted

## Context

JournalAudit logging was split across two paradigms:

1. **`lib/audit-bus.ts`** — a shallow `AuditBus` class with a single `log` method, injected via constructor parameter into `UtilisateurService`, `VehiculeService`, and imported as a singleton by `app/api/societe/route.ts`. The class was tested via a mock DB object with artificial spies (a pattern ADR-0006 deprecated). Constructor dependency injection of `auditBus` added noisy boilerplate without providing real polymorphism.

2. **`lib/demande/effets-transition.ts`** — an inline `tx.insert(journalAudit).values({...})` call inside the transition side-effect seam. This duplicated the audit-insertion logic in a second location, with ad-hoc `JSON.stringify` for the `details` column.

The split meant:
- Any change to the audit row shape required edits in two places.
- The `AuditBus` test suite violated ADR-0006's principle (mock-db spies that could not surface schema or JSON serialization bugs).
- Services carried constructor boilerplate (`private audit = auditBus`) that was never overridden in production — it was always the singleton.

## Decision

**Reify JournalAudit as a deep, single-entrypoint module** (`lib/audit.ts`) exporting the free function `logAudit(event, dbOrTx = db)`. Delete `AuditBus` class and its mock-DB test suite. Replace with a PGLite integration test suite (`lib/audit.test.ts`).

### Module shape

```
lib/
  audit.ts      — AuditEvent interface + logAudit(event, dbOrTx = db) free function
  audit.test.ts — PGLite integration tests (real SQL writes, transactions, rollback)
```

### `logAudit` function signature

```ts
export interface AuditEvent {
  utilisateurId: string
  action: string
  entite: string
  entiteId?: string
  details?: Record<string, unknown>
}

export async function logAudit(event: AuditEvent, dbOrTx: DrizzleDb = db): Promise<void>
```

The function handles `crypto.randomUUID()` for the row ID, nullable `entiteId`, and `JSON.stringify` for `details` — all concerns that were previously duplicated between `audit-bus.ts` and `effets-transition.ts`.

### Call-site convergence

All audit writes now flow through `logAudit`:

| Call site | Before | After |
|---|---|---|
| `UtilisateurService.create` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `UtilisateurService.update` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `UtilisateurService.changePassword` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `UtilisateurService.updateProfile` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `VehiculeService.create` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `VehiculeService.update` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `VehiculeService.delete` | `this.audit.log({...})` | `logAudit({...}, this._db)` |
| `app/api/societe/route.ts` | `auditBus.log({...})` | `logAudit({...})` |
| `appliquerEffets` in `effets-transition.ts` | `tx.insert(journalAudit).values({...})` | `logAudit({...}, tx)` |

### Service constructors simplified

`UtilisateurService` previously accepted three constructor parameters (`_db`, `audit`, `avatarStorage`). The `audit` parameter is removed — the service now imports `logAudit` from `lib/audit` directly and calls it with `this._db`:

```ts
// Before
constructor(private _db: DrizzleDb, private audit = auditBus, ...) {}

// After
constructor(private _db: DrizzleDb, ...) {}
```

`VehiculeService` follows the same pattern.

### Testing strategy

| Layer | Seam | Rationale |
|---|---|---|
| `logAudit` persistence | PGLite | Real SQL writes to `journal_audit`; JSON serialization; nullable columns; transaction scoping; rollback |
| Service orchestration | `vi.mock("./audit", ...)` | Mock `logAudit` is asserted on `toHaveBeenCalledWith`; no hidden SQL bug in the service layer |

## Rationale

- **Single audit entrypoint** eliminates duplication between `audit-bus.ts` and `effets-transition.ts`. Any schema change to `journal_audit` now requires edits in one file only.
- **PGLite integration tests** surface JSON serialization bugs, nullable-column handling, and transaction behaviour that mock-DB spies could not detect.
- **Removing constructor injection** from services eliminates boilerplate that had no production value — the `audit` parameter was never overridden in any production call site.
- **The deep module pattern** matches ADR-0010's treatment of the Notification domain: a module-level free function (`logAudit`) with PGLite-backed integration tests, aligned with ADR-0006's architectural principle.
- **ADR-0007's deferral** ("JournalAudit logging for non-transaction callers continues to use the existing `auditBus.log` interface", ADR-0007 line 41) is closed — all callers now converge on `logAudit`.

## Consequences

- ADR-0007's deferral for non-transaction audit callers is closed.
- ADR-0006's principle is fully applied: no remaining single-adapter-with-trivial-mock-test modules exist in the codebase after this change alongside ADR-0010.
- The `AuditEvent` interface is canonical — used by all call sites and tested against real SQL.
- Service constructors are simpler (two parameters for `UtilisateurService`, one for `VehiculeService`).
- `appliquerEffets` delegates to `logAudit` with the transaction `tx`, preserving the rows-only, within-transaction invariant.
