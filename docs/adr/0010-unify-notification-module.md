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

The `NotificationAdapter` interface and `AdapterResult` type are declared in `adapter.ts` (moved from `notification-bus.ts`). The interface seam is preserved — the orchestration test suite continues to use the same `mockAdapter()` pattern. *(Post-adoption annotation: the second half of that sentence no longer holds. Issue #312 deleted `mockAdapter()`, `mockSelectResult` and `mockDb` and converted the suite to PGLite; the suite no longer substitutes the interface. The interface itself stays declared, because the class is still constructed with one — what went is the tests' use of it, not the seam it declares. See the annotations in Rationale and Consequences.)*

### `buildMessage` / `resolveRecipients` relocation

Both helpers move from `lib/demande/effets-transition.ts` into `lib/notification/helpers.ts`. `effets-transition.ts` imports them back from `lib/notification`. Dependency direction becomes `lib/demande/ → lib/notification/`, which is correct: transitions depend on the notification domain.

### Who receives a Notification, and who may read one

**An inactive Utilisateur neither RECEIVES nor PRODUCES a Notification.** One rule, three paths, and the module applies it to all of them: the role targets, the employee the payload names, and the Assignataire it names. `markAsRead` asks the same question about its reader, so a deactivated Utilisateur cannot set `lu` and cannot produce a read receipt.

The rule is not re-spelled here. It is composed from `conditionActif`, the fragment the Utilisateur module exports and the one its per-Utilisateur answer `peutAgir` is derived from — so « only active Utilisateurs are notified » cannot drift from « a Utilisateur may act only while active » (#313, #315), and the two notification paths cannot drift from each other either.

*(This section was added by #355 and #356. Until then the module applied the rule to the role targets alone: the employee and the Assignataire were added outright, and `markAsRead` asked nothing. The gap was user-visible rather than academic, because `EVENT_ROLE_MAP` is empty for `DEMANDE_APPROBATION_FINALE` and `DEMANDE_REJETEE` — for those two events the employee addition IS the entire notification surface, so a Utilisateur deactivated after filing their DemandeDeplacement was told, by mail, that it had been decided. #315's narrower intent — « still adds the employee and the assignee regardless of activity », recorded deliberately then — is SUPERSEDED by this decision rather than forgotten: the additions were the resolver's own recipient rules, and « a Utilisateur who cannot act is nonetheless told about their own DemandeDeplacement » is not a distinction that survives being written down. The test that recorded the old intent was rewritten to assert this rule, not deleted.)*

*(On where the read-path check lives: in the module, not at the route. `app/api/notifications/[id]/route.ts` was already closed to an inactive Utilisateur — `requireAuth()` answers 401 « Non autorisé » because `currentUser()` asks `peutAgir` — so the production path did not depend on it. It is in the module because `markAsRead` takes a handle and is called with one directly by tests and by any future caller, and an invariant that holds only because one caller remembered a check is not an invariant. This is the defect class #309 and #310 exist for.)*

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

*(Post-adoption annotation: this sketch records the shape as adopted and no longer describes the code. Issue #310 removed `_db` from the constructor — the handle is a per-call parameter on all three entries — and issue #311 deleted `DispatchResult`, which had no production reader, replacing it with an optional `reportFailure` reporter and a `Promise<void>`. The bound exports below were also replaced by free functions that default the handle to `db`; see the annotation in Rationale.)*

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
| `dispatch` / `markAsRead` orchestration | PGLite, through the exported entries | *(Post-adoption annotation, #312: was `NotificationAdapter` interface mock. The mock could not be wrong — the module asked for the managers and the mock produced them — so what the suite said about recipient rules was a statement about the stub. Tests state rows now.)* |
| `DrizzleNotificationAdapter.send` (row insert) | PGLite | Confirms row lands in `notifications` table with correct fields |
| `sendEmail` (recipient lookup + email) | PGLite + mock `emailSender` | Real SQL for the `utilisateurs` select; transport stays mocked |
| `listForUser` / `countUnread` | PGLite | Surfaces `lu = false` bug; real ordering and limit behaviour |

### What this does NOT do

- **This does not alter the rows-only invariant in `EffetsTransition`** (ADR-0007 locked). Email dispatch is still explicitly out of scope for transitions — the `sendEmail` call fires from `dispatch`, not from `appliquerEffets`.
- **This does not re-deepen the `EmailSender` module** (ADR-0008 locked). The email transport seam and `loadSocieteIdentity` resolver are unchanged.
- **This does not change the `NotificationAdapter` interface seam** used by the orchestration test suite. The interface is preserved at its current shape. *(Post-adoption annotation: the seam has since evolved — issue #145 changed `send` to take the db per-call (`send(notification, dbOrTx)`) and added a rows-only `dispatchRows(event, payload, tx)` path; "preserved at its current shape" refers to the pre-unification shape.)*
- **This does not add a `lib/email/` subdirectory.** Revisit if a future candidate grows the email surface beyond the current two-function shape.

## Rationale

- **Collapsing `notification-queries.ts` satisfies ADR-0006's final outstanding target.** ADR-0006 collapsed single-adapter seams at the DemandeDeplacement DB boundary. `notification-queries.ts` was the last module outside that boundary that followed the same single-adapter-with-trivial-mock-test pattern. Deleting it and replacing the tests with PGLite integration tests completes ADR-0006's mandate.
- **The `lu = false` bug was invisible to the mock-db suite.** The mock always returned a hardcoded value (`[{ value: 3 }]`), so the missing filter was never exercised. Moving to PGLite surfaced the bug and locked the fix.
- **The `dispatch` / `markAsRead` orchestration test suite preserved its adapter-mock seam.** The 330-line test suite migrated with import-path updates only — the `NotificationAdapter` interface and `mockAdapter()` pattern are unchanged. The seam is valid (no hidden SQL bug) and the test investment in the old suite is preserved. *(Post-adoption annotation: superseded by issue #312. The suite no longer instantiates `NotificationModule` with `mockAdapter()` — all three fakes (`mockAdapter`, `mockSelectResult`, `mockDb`) are gone and every test reaches the exported names against PGLite. The claim above that « the seam is valid » was the deciding argument at the time, and #312 is what showed it was not: a fake that answers whatever the code asks for cannot be wrong, so « DEMANDE_SOUMISE reaches the employee's own Department's managers » was a statement about the stub. The `NotificationAdapter` interface itself is untouched and stays — what went is the tests' use of it, not the seam it declares.)*
- **`buildMessage` and `resolveRecipients` belong in the notification domain.** Placing notification vocabulary in `lib/demande/` was an artifact of ADR-0007's deduplication within its scope. Returning them to `lib/notification/` makes the dependency direction correct: transitions produce notifications.
- **The `NotificationModule` class pattern matches `EmailSender` from ADR-0008.** The class is exported for tests to instantiate with mock dependencies; the module-level singleton wires production defaults. This avoids the need for optional `adapter`/`db` parameters on the named function exports while keeping the test seam explicit. *(Post-adoption annotation: the class now takes only the adapter — issue #310 made the database handle a per-call parameter on `dispatch`, `dispatchRows` and `markAsRead`, so the class captures no handle at all. `dispatch` and `markAsRead` gained an optional `tx = db` so the production call sites stayed byte-identical; the claim above about avoiding a `db` parameter referred to making it *required at every call site*, and the rows-only path `dispatchRows` keeps its required `tx`. The `adapter` parameter was never optional and is unchanged.)*

## Consequences

- ADR-0007's deferral ("Re-sectioning is Candidate 4's territory", ADR-0007 line 45) is closed.
- ADR-0008's deferral ("Email content and recipient lookup stay in `DrizzleNotificationAdapter.send` — those are Candidate 4's territory", ADR-0008 line 41) is closed.
- ADR-0006's principle is fully applied: no remaining single-adapter-with-trivial-mock-test modules exist in the codebase.
- `lib/notification/` is the canonical home for all notification logic — dispatch, markAsRead, queries, email send.
- `lib/demande/effets-transition.ts` depends on `lib/notification/` (correct direction: transitions produce notifications).
- `dispatch` calls `sendEmail` after the adapter row insert succeeds — the two-step orchestration is explicit and independently testable.
- **An inactive Utilisateur is neither a recipient nor a read-receipt source** (#355, #356). Three recipient paths carry the rule — role targets, the employee the payload names, the Assignataire it names — and `markAsRead` asks it of its reader. A Utilisateur deactivated mid-pipeline is therefore not told that their own DemandeDeplacement was approved or rejected, and their reading one is not announced to their Department's managers. The filter is applied by composing `conditionActif`, never by re-spelling it, so there is one definition of « active » in the codebase.
- The `NotificationAdapter` interface remains the seam the module is constructed with; PGLite covers persistence and query correctness. *(Post-adoption annotation: #312 moved the suite off the interface — every test now reaches the exported entries against a real database, so the interface is no longer substituted in a test. It stays declared because the class is still built with one; it simply no longer earns its keep by being the thing tests inject.)*
