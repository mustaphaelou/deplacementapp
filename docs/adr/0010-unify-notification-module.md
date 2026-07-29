# ADR 0010: Unify the Notification module — collapse notification-queries, re-section adapter, fix lu=false bug

**Date:** 2026-07-29

**Status:** Accepted

## Context

The Notification concept was split across three modules:

1. **`notification-bus.ts`** — `DrizzleNotificationAdapter.send` bundled three concerns in one method: insert the notification row, look up the recipient's email from `utilisateurs`, and build + send the HTML email. ADR-0007 explicitly deferred re-sectioning: "Re-sectioning is Candidate 4's territory" (line 45). ADR-0008 explicitly deferred: "Email content and recipient lookup stay in `DrizzleNotificationAdapter.send` — those are Candidate 4's territory" (line 41).

2. **`notification-queries.ts`** — a shallow read module (`listForUser`, `countUnread`) backed by a mock-db test suite. `countUnread` was missing a `lu = false` filter (it counted *all* notifications for the user, not just unread ones). The mock never exercised real SQL, so the bug was invisible. This was the last remaining "single-adapter with trivial mock test" module that ADR-0006 targeted.

3. **`lib/demande/effets-transition.ts`** — hosted `buildMessage` and `resolveRecipients`, two helpers that are notification vocabulary (building notification messages, resolving notification recipients) but were placed in `lib/demande/` when ADR-0007 deduplicated them. They belong in the notification domain. ADR-0007 noted: "notification-bus.ts imports them from there" (line 61) — a dependency direction (`lib/demande/ → lib/notification/`) that was already anomalous.

The result: notification logic was scattered, the adapter lacked depth, the only production bug (`countUnread`) was hidden behind a mock, and two ADRs carried open deferrals.

## Decision

**Create one `lib/notification/` deep module** with four named-function exports — `dispatch`, `markAsRead`, `listForUser`, `countUnread` — backed by PGLite where real SQL matters.

### Module layout

```
lib/notification/
  helpers.ts    — buildMessage, resolveRecipients (relocated from lib/demande/effets-transition.ts)
  queries.ts    — listForUser, countUnread (absorbed from lib/notification-queries.ts; lu=false fixed)
  adapter.ts    — DrizzleNotificationAdapter (row insert only) + exported sendEmail helper
  index.ts      — dispatch, markAsRead as named exports; re-exports types
```

### Adapter re-sectioning

`DrizzleNotificationAdapter.send` becomes a thin row-writer (one concern: insert the notification row). An exported `sendEmail(notification, db)` function in `lib/notification/adapter.ts` handles recipient lookup from `utilisateurs` + HTML template build + `emailSender.send`. `dispatch` orchestrates: resolve recipients → build message → insert row via adapter → send email via `sendEmail`.

The `NotificationAdapter` interface and `AdapterResult` type are declared in `adapter.ts` (moved from `notification-bus.ts`). The interface seam is preserved — the orchestration test suite continues to use the same `mockAdapter()` pattern.

### `buildMessage` / `resolveRecipients` relocation

Both helpers move from `lib/demande/effets-transition.ts` into `lib/notification/helpers.ts`. `effets-transition.ts` imports them back from `lib/notification`. Dependency direction becomes `lib/demande/ → lib/notification/`, which is correct: transitions depend on the notification domain.

### `lu = false` bug fix

`countUnread` in `lib/notification/queries.ts` adds `eq(notifications.lu, false)` to its `.where()` clause. A PGLite integration test inserts both read and unread rows and asserts the count reflects only unread ones — a test that the previous mock-db suite structurally could not write.

### Named function exports

`dispatch` and `markAsRead` are module-level named functions backed by a `NotificationModule` class (exported for testing, matching the pattern used by `EmailSender` in ADR-0008):

```ts
export class NotificationModule {
  constructor(private adapter: NotificationAdapter, private _db: DrizzleDb) {}
  async dispatch(event, payload): Promise<DispatchResult> { ... }
  async markAsRead(notificationId, userId): Promise<void> { ... }
}

const _default = new NotificationModule(new DrizzleNotificationAdapter(db), db)
export const dispatch = _default.dispatch.bind(_default)
export const markAsRead = _default.markAsRead.bind(_default)
```

`listForUser` and `countUnread` are free functions (no class wrapper):

```ts
export async function listForUser(userId: string, db: DrizzleDb): Promise<Notification[]>
export async function countUnread(userId: string, db: DrizzleDb): Promise<number>
```

### Files deleted

- `lib/notification-bus.ts` — deleted; all importers updated to `lib/notification`
- `lib/notification-queries.ts` — deleted; absorbed into `lib/notification/queries.ts`
- `lib/notification-queries.test.ts` — deleted; replaced by PGLite tests

### Testing strategy

| Layer | Seam | Rationale |
|---|---|---|
| `dispatch` / `markAsRead` orchestration | `NotificationAdapter` interface mock | Valid seam; no hidden SQL bug; 330-line suite migrated with import-path updates |
| `DrizzleNotificationAdapter.send` (row insert) | PGLite | Confirms row lands in `notifications` table with correct fields |
| `sendEmail` (recipient lookup + email) | PGLite + mock `emailSender` | Real SQL for the `utilisateurs` select; transport stays mocked |
| `listForUser` / `countUnread` | PGLite | Surfaces `lu = false` bug; real ordering and limit behaviour |

### What this does NOT do

- **This does not alter the rows-only invariant in `EffetsTransition`** (ADR-0007 locked). Email dispatch is still explicitly out of scope for transitions — the `sendEmail` call fires from `dispatch`, not from `appliquerEffets`.
- **This does not re-deepen the `EmailSender` module** (ADR-0008 locked). The email transport seam and `loadSocieteIdentity` resolver are unchanged.
- **This does not change the `NotificationAdapter` interface seam** used by the orchestration test suite. The interface is preserved at its current shape.
- **This does not add a `lib/email/` subdirectory.** Revisit if a future candidate grows the email surface beyond the current two-function shape.

## Rationale

- **Collapsing `notification-queries.ts` satisfies ADR-0006's final outstanding target.** ADR-0006 collapsed single-adapter seams at the DemandeDeplacement DB boundary. `notification-queries.ts` was the last module outside that boundary that followed the same single-adapter-with-trivial-mock-test pattern. Deleting it and replacing the tests with PGLite integration tests completes ADR-0006's mandate.
- **The `lu = false` bug was invisible to the mock-db suite.** The mock always returned a hardcoded value (`[{ value: 3 }]`), so the missing filter was never exercised. Moving to PGLite surfaced the bug and locked the fix.
- **The `dispatch` / `markAsRead` orchestration test suite preserved its adapter-mock seam.** The 330-line test suite migrated with import-path updates only — the `NotificationAdapter` interface and `mockAdapter()` pattern are unchanged. The seam is valid (no hidden SQL bug) and the test investment in the old suite is preserved.
- **`buildMessage` and `resolveRecipients` belong in the notification domain.** Placing notification vocabulary in `lib/demande/` was an artifact of ADR-0007's deduplication within its scope. Returning them to `lib/notification/` makes the dependency direction correct: transitions produce notifications.
- **The `NotificationModule` class pattern matches `EmailSender` from ADR-0008.** The class is exported for tests to instantiate with mock dependencies; the module-level singleton wires production defaults. This avoids the need for optional `adapter`/`db` parameters on the named function exports while keeping the test seam explicit.

## Consequences

- ADR-0007's deferral ("Re-sectioning is Candidate 4's territory", ADR-0007 line 45) is closed.
- ADR-0008's deferral ("Email content and recipient lookup stay in `DrizzleNotificationAdapter.send` — those are Candidate 4's territory", ADR-0008 line 41) is closed.
- ADR-0006's principle is fully applied: no remaining single-adapter-with-trivial-mock-test modules exist in the codebase.
- `lib/notification/` is the canonical home for all notification logic — dispatch, markAsRead, queries, email send.
- `lib/demande/effets-transition.ts` depends on `lib/notification/` (correct direction: transitions produce notifications).
- `dispatch` calls `sendEmail` after the adapter row insert succeeds — the two-step orchestration is explicit and independently testable.
- The `NotificationAdapter` interface remains the seam for orchestration tests; PGLite covers persistence and query correctness.
