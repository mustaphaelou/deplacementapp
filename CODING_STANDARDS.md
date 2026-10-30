# Coding standards

Read during **review**, not during implementation. Everything decidable by a
machine belongs in a check instead — `npm run lint`, `npm run typecheck`,
`npm test`, `npm run frontend:drift`, and the `verify` CI job that runs all
four. This file is only for the judgement no guardrail can make: cross-file
consistency, "does this match the surrounding style", and the traps where a
green suite is telling you something false.

If a rule here starts describing a fixed syntactic pattern, a banned API, an
import shape, or a file-location rule, it is not a standard — build the check
and delete the rule.

## A test that derives its expectation from the code under test is not a test

The rule this repo is most able to fool itself with. A guard whose entire job is
catching omissions will be written to agree with whatever is currently there:

```ts
// Broken: both sides of the assertion come from the same array.
for (const href of NAV_ADMINISTRATION) expect(sidebarLinks).toContain(href)
```

Delete an entry from `NAV_ADMINISTRATION` and this stays green. On #281 it went
from 50 passing to 33 passing, fully green, on the exact surface the spec
existed to protect.

**The test:** every literal a test expects must be written out in the test.
Pin the values; do not import them from the module that owns them. The duplicate
is the cost of the pin, and it is the entire point.

**The proof:** before trusting a new guard, break the thing it guards and
confirm it goes red. Re-inject the original defect, run, confirm red, revert.
A guard never observed red is indistinguishable from one that does nothing.

## Assert denial outcomes, not reason codes

Where a function can return several errors for one bad input, assert the class
of refusal. `checkTransition` checks stage and role *before* the terminal
decision, so at Etape FINAL a wrong role is `WRONG_ROLE`, not `TERMINAL` — an
assertion on the code is coupled to an ordering that is not part of the
contract, and it will fail for an unrelated change.

## A rule that cannot cite its authority does not belong in the set

Applies to the drift checker and to any lint rule added here. Each rule states
the issue that decided it. A finding you cannot trace to a decision usually
means the rule is wrong, not the code — check `OUT_OF_SCOPE` / `ALLOWLIST`
before changing app code. `RULE_FOCUS_RING` earned its current precise form
only after an earlier, broader version produced six false positives on a clean
tree: a checker that cries wolf is worse than no checker.

## Re-measure the baseline; never quote it from memory

Test counts and lint warnings move with `main`. `git stash` and re-run is the
only trustworthy measurement, and a subagent that contradicts a briefed
baseline with a measured one is right, not wrong. Lint's baseline is three
`no-img-element` warnings (`login/page.tsx`,
`administration/societe/page.tsx`, `sidebar.tsx`) — not four; the `imprimer`
page's `<img>` already carries a disable comment.

## Before claiming a UI defect is fixed

A class string is not proof and a screenshot of a class string is not proof.
Verify the rendered pixels — see `docs/agents/frontend-drift.md` for the probe
recipe. `capture_screenshot()` returns the same path every call: copy each to a
distinct file immediately or you will analyse one image twice believing you
compared two.
