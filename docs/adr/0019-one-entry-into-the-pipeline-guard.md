# ADR 0019: The guard has one entry — the reason is the answer, and the table that names it lives in the error module

**Date:** 2026-10-05

**Status:** Accepted

## Context

The pipeline's guard (`lib/workflow.ts`, the check the transition writer and the action reader both ask) grew a second and third way in before anyone wrote down that it had any. Ticket #299 collapsed three of them into one and left no record of why; the numbering sequence jumps from 0018 to 0020 because nothing was filed. The decision therefore lives only in the code and in three commit messages, which is precisely the state in which the next architecture review re-proposes what was just deleted — the review's own candidate list was assembled without it.

What #299 found, and what this ADR records, is that the guard's *engine* and the guard's *entry* are different things with different fates:

- The **engine** — `checkTransition`, the five-input function returning `{ ok: true } | { ok: false; reason }` — is not a projection. `resoudreTransition` calls it, and it is the route the refusal sweep and the pipeline's own guard suite take in order to enumerate verdicts over the whole Role × Etape × action × Decision × ownership space. Inlining it would close the only route in.
- The **projections** were thin wrappers the same module used to offer above it, and each destroyed exactly one thing:
  - `canTransition` — the **boolean** — called `checkTransition(…, true)`: it hardcoded `ownerMatch` to `true`, so it answered « may this actor act » for an actor it never asked about. The ownership question did not survive it. It also had no `ownerMatch` parameter at all, so a caller could not have passed the fact even if it wanted to.
  - `buildTransition` — the **`null`** — mapped a reason-typed refusal back to `null`. That is the ambiguity #299 existed to remove, reintroduced one function below its own fix: a caller reading it could not tell « the guard refused, and here is why » from « nothing to do ».

  Both are gone (#362, #363). The reason type's home and the refusal table's home are also two places, which reads like drift and is not.

## Decision

**One production entry into the guard: `resoudreTransition`.** No other function in the repository asks the guard to apply a transition. A writer obtains `{ ok: true; transition }` or `{ ok: false; reason }` — two answers, no third — and raises `refusPourTransition(resolution.reason, action)` on the second.

**The engine stays exported.** `checkTransition` is public surface for a reason that is not convenience: it is the seam the whole refusal vocabulary is verified through, and it is also why the entry can be *composed* of a guard call plus a payload build rather than duplicating the guard's rules.

**The two projections stay deleted**, and their two destroyed things stay named as the reason: the boolean destroyed the ownership question, the `null` destroyed a refusal's reason.

**The reason/error split is deliberate, and it is a dependency-direction rule, not a placement preference.** `TransitionCheckReason` is declared in `lib/workflow.ts` beside the pipeline's own unions (`Etape`, `Decision`, `WorkflowAction`); `REFUS_TRANSITION` and `refusPourTransition` live in `lib/errors.ts` beside the classes they build. The reason stays beside the unions because the pipeline module keeps **no runtime import at all** — both of its imports are `import type` — and a React module reads it (`app/(dashboard)/demandes/page.tsx`). `lib/errors.ts` imports `next/server` at runtime, so the dependency may only ever run in that one direction: the error module reads the guard's reason *type* and nothing else. A refusal is therefore a **value the caller carries to the table**, never an exception thrown at the guard's boundary.

### What this means in practice

- **One production entry.** `resoudreTransition(role, etape, action, params)` with `params.ownerMatch` required and undefaulted. Two production callers today: the transition writer (`lib/demande/mutations.ts`) and the creation path (`etatCreation`). The reader below takes the same route.
- **The engine is exported and used for enumeration, not for writing.** `checkTransition` is what the exhaustive sweeps in `lib/workflow.test.ts` and `lib/errors.test.ts` ask, because a sweep needs the raw verdict — including the reason — at every tuple, and the production entry re-derives the effect lookup after the guard has admitted. Two consumers, both tests, both mechanical.
- **The ownership input has no default anywhere.** `checkTransition`'s `ownerMatch: boolean` is a required parameter on a line of its own, pinned on the module's own source. That is the direct anti-pattern to the deleted boolean's hardcoded `true`, and the pin is a source pin precisely because a behavioural pin could not see a default that has not been exercised.
- **`getAllowedActions` is out of scope and deliberately kept.** It is a *projection*, but not one of these two: it has one production caller (the detail page, `app/(dashboard)/demandes/[id]/page.tsx`), it carries the ownership fact IN rather than assuming it, and it delegates every one of its four verdicts to the production entry. It is candidate 08 of the same review and is a separate decision; nothing here argues for or against it.
- **The reason set is closed, and it is pinned from both ends.** `REFUS_TRANSITION` is typed `Record<TransitionCheckReason, RefusTransition>`, so a reason added to the type without a row is a compile error; and `lib/workflow.test.ts` sweeps the production entry over the full tuple space and asserts the set of reasons it produces equals the table's keys — non-vacuous, so an emptied sweep cannot satisfy it.

### What this does not mean

- **Not that the guard's internals are private.** `checkTransition` is deliberately public; see above.
- **Not a change to the check order.** The Etape's seat is still read before the Decision, so at `FINAL` the reason is `WRONG_ROLE` and never `TERMINAL`. That is the guard's existing behaviour, unchanged, and pinned.
- **Not a change to the wire.** The codes and French sentences are ADR-0022's subject and are untouched here; this ADR records only where the table lives and why.
- **Not a rule about refusing to add a second entry.** If a future caller needs to apply a transition through a route that cannot carry `ownerMatch`, the answer is a decision to revisit *this* ADR with the missing fact named — not to add a wrapper that supplies a default.

## Rationale

- **A record exists so the next review does not re-litigate.** The projections were deleted by the two tickets that preceded this one and their reasons are in those commit bodies. The sequence gap is the actual defect: a decision with no ADR is a decision the next reader will make again.
- **The projections each destroyed something, and the destruction was silent.** A boolean is not a weaker reason — it is a *different* question, one whose answer does not depend on a fact it never received. A `null` is not a shorter reason — it is the absence of one. Both were types that made the right thing unreachable rather than merely discouraged.
- **The refusal is a value, and that is what makes the table work.** Because the guard answers with a reason instead of raising, the mapping from reason to French sentence happens in ONE table that a writer cannot partially apply and cannot skip. If the guard threw, the table would have to be consulted inside the guard, and the guard would need a runtime import of `next/server` — which the React module that reads it forbids.
- **The dead arm is dead, and recording the proof saves the re-derivation.** The creation path's refusal arm is unreachable: read against the guard, the tuple it passes — the opening lane's seat (`PIPELINE[0].roleCanAct`, `EMPLOYEE`), the opening Etape (`DRAFT`), the `submit` action, no recorded Decision, and ownership by birth — is admitted at the first check. The terminal check is skipped because no Decision is recorded; the owner-action check passes on ownership; and an effect exists for `submit` at `DRAFT`. **There is no input the creation path can pass that the guard refuses.** The arm is therefore kept as a `throw` — the arm of a real union, not a `null` check a caller could read as an absence — and its unreachability is a proven property of the pipeline, not an assumption.
- **Closedness is worth pinning twice, from opposite ends.** The `Record` type makes the table total in the compile direction; the sweep makes it total in the *reachability* direction, which no type can state: a fifth reason on a branch the tuple space reaches is a failing test until it is named. Neither alone would do.

## Consequences

- `resoudreTransition` is the only production entry; `checkTransition` is exported and its two consumers are test sweeps. **The cost, stated:** the module now exports a function whose whole purpose is to be asked by tests, which is a wider surface than "one entry" suggests, and a reader counting exports will find two functions and have to read this ADR to know which is the writer's door. That is the price of keeping the enumeration route, and it is paid knowingly.
- The creation path's `throw` is unreachable today. **The cost, stated:** a linter or a reader may flag it as dead code, and it is not — it is the arm that makes `Resolution` a real union rather than a type that could grow a `null` later without a compile error. It also carries a French sentence inside the pipeline module, which the module's own pin exempts **by name** as an invariant throw; a third such sentence fails that pin rather than joining the list.
- `lib/errors.ts` must keep its dependency on `lib/workflow.ts` type-only. If someone imports `checkTransition` there to « just check something », the React module reading the pipeline pulls `next/server` into a client bundle. The pin reads `lib/workflow.ts`'s source, so it catches the pipeline's own imports and not that one — a real gap, named rather than papered over.
- A fifth reason is now a compile error (missing row) *and*, once reachable, a failing sweep. Two mechanisms, deliberately overlapping.
- **Two files now make the closure comparison**, and that duplication is deliberate for now: `lib/errors.test.ts` derives it from the guard's engine, this suite from the production entry, so they fail on different edits — a reason reachable only past the entry's own second effect lookup would be caught by one and not the other. `lib/errors.test.ts` is not edited to match. When a third reader wants the same claim, the two should be consolidated onto one shared helper rather than a third copy written.
- **For the next architecture review: do not re-propose `canTransition` or `buildTransition`, and do not propose any second production entry into the guard.** The cost of re-adding them is the specific defect each one carried: the boolean re-asserts ownership the caller never checked — a silent permission, the exact class #299 was opened to remove — and the `null` re-merges « refused » with « nothing to do », which is the ambiguity that let a reason go unrecorded in the first place. A wrapper that hardcodes `ownerMatch: true` for convenience is the boolean under a new name, and the source pin on the required parameter is what would have to be weakened to land it.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors (3 pre-existing `no-img-element` warnings in `components/sidebar.tsx`).
- `npm test` — **1167 passed / 8 skipped, 94 files**, measured on a clean tree at this branch's base (`835e3a4`: 1166 passed / 8 skipped) with the new closure case as the whole delta.
- **The closure assertion proven to bite**, from a green baseline, both arms restored byte-identically afterwards (hash-verified against a pre-mutation snapshot taken outside the repo):
  - *A fifth reason on a branch the sweep reaches* — a `reason: "FIFTH"` refusal injected in place of the guard's seat refusal (`!stage || !stage.roleCanAct`, the FIRST check, which 160 of the 800 tuples reach — every Role × action × Decision × ownership at `FINAL`, the one Etape with no seat): RED, `AssertionError: expected [ 'FIFTH', 'NOT_OWNER', …(3) ] to deeply equal [ 'NOT_OWNER', 'NO_EFFECT', …(2) ]` at `lib/workflow.test.ts:1338` (5 failed | 98 passed in that file). A branch after an early `return` would have been the trap here; this is the first one, and the failure names the fifth reason rather than a count, which is the shape the assertion was written for.
  - *The sweep collects nothing* — the collection gated so no refusal is ever recorded (`if (!resolution.ok && tuples < 0)`): RED, `AssertionError: aucun tuple refuse: le balayage n'a rien collecte: expected 0 to be greater than 0` at `lib/workflow.test.ts:1328` — the non-vacuity assertion, not the closure one, which is the whole point of putting it first.
- The guard's structural pins stay green and were not touched by this ADR: no `buildTransition` in the module's export surface, `ownerMatch` required with no default, the writer's single call and the reader's single delegation, and `lib/errors.test.ts`'s "imports nothing at runtime: every import is type-only".
