# Command-Query Separation (CQS)

**CQS** is a design principle: a function should be either a **command** (mutates state, may return void/nothing) or a **query** (returns data, has no side effects), but not both.

## Applied to state machine guards

| Role | Example | Returns | Side effects |
|---|---|---|---|
| **Query** | `canTransition(role, etape, action, decision)` | `boolean` | None — safe to call anytime |
| **Command** | `buildTransition(role, etape, action, params)` | `WorkflowResult` (or throws) | Builds transition data; throws on invalid |

## Why it matters here

- **Queries** are safe to call from the UI layer to show/hide buttons. They never throw.
- **Commands** throw when the operation can't proceed. Callers must handle exceptions.
- If you delete the query (`canTransition`), there's no cheap way to ask "can I?" without catching exceptions — which is awkward and conflates control flow with error handling.

## Patterns for handling both

1. **Query kept public** — `canTransition` stays exported, used by UI + internally by command
2. **Query kept internal** — `canTransition` is not exported but still exists inside `workflow.ts` for `getAllowedActions`
3. **Query deleted** — no way to ask "can I?" without try/catching the command
