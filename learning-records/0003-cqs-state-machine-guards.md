# Learning Record 0003: Command-Query Separation for State Machine Guards

**Date:** 2026-07-19

## What I learned

When collapsing a three-layer guard into a single throwing function, the query function (`canTransition`) doesn't have to die — it can stay internal to the module. This preserves a cheap way to ask "can I?" without catching exceptions, while still exposing only one public entry point.

## Key insight

- Commands (throw on failure) and queries (return bool) serve different purposes.
- A command that throws is not a good replacement for a boolean query — exceptions should be for exceptional paths, not for checking preconditions.
- Keeping `canTransition` internal but not exported avoids the "three-layer" problem while preserving the query for `getAllowedActions`.

## Consequences for the refactor

- `canTransition` stays in `workflow.ts` (internal, not exported).
- `getAllowedActions` stays in `workflow.ts` (internal, not exported — zero callers confirmed).
- `buildTransition` becomes the single exported entry point, throwing typed errors.
- `demande-workflow.ts` drops its `canTransition` call.
