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

## The radius scale is remapped — never read it as shadcn defaults

`app/globals.css` sets `--radius: 0.1875rem` and maps `--radius-lg: var(--radius)`.
There is no literal 8px radius in the compiled stylesheet. `rounded-lg` is 3px
here. To learn what a class actually emits, compile a probe against the real
`app/globals.css` through a PostCSS pass — a bare `@import "tailwindcss"` probe
will not resolve theme tokens. Assert your probe's premise before trusting its
output (e.g. that the container really has `overflow: hidden`).

## Do not run the full suite while another suite is running

The suite stands up one PGlite per test file. Concurrent runs exhaust CPU and
memory and produce 9–11 failures that look like real breakage.
`maxWorkers: 2` is the whole budget. A test log produced under contention is
evidence about the machine that produced it, not about your branch — triage by
the log's timestamp against your fix commit, and by whether the file:line it
quotes still exists.

`mockResolvedValue is not a function` is a **timeout symptom**, not a mocking
bug: a timed-out test leaves the module registry half-initialised, so the next
dynamic import returns the real module instead of the mock. Fix the timeout
budget.

## `npm run format` is not free

`.prettierrc` loads `prettier-plugin-tailwindcss` with
`tailwindFunctions: ["cn", "cva"]`, so formatting **reorders class lists** — and
tests in this repo assert literal class strings (`"uppercase tracking-[0.06em]"`,
`"rounded-[3px] bg-primary/10"`). Formatting a file that contains one can turn
the suite red with no visible cause. Check for such tests first, or format
deliberately rather than on commit. The pre-commit hook runs eslint only, for
this reason.

## Re-measure the baseline; never quote it from memory

Test counts and lint warnings move with `main`. `git stash` and re-run is the
only trustworthy measurement, and a subagent that contradicts a briefed
baseline with a measured one is right, not wrong. Lint's baseline is three
`no-img-element` warnings (`login/page.tsx`,
`administration/societe/page.tsx`, `sidebar.tsx`) — not four; the `imprimer`
page's `<img>` already carries a disable comment.

## Confirm the tree is yours before trusting a per-arm result

Before trusting any measurement in a worktree you do not exclusively own, run
`git status --porcelain` and confirm it is clean, and re-read any file you wrote
earlier in the session before committing it. A concurrent agent can rewrite your
work mid-task, and a mutation experiment that "passed" may have been masked by
someone else's red.

## Domain vocabulary

Use `CONTEXT.md`'s terms exactly — DemandeDeplacement, Etape, Decision, Utilisateur,
Role, Sociète. Not "trip", "request", "tenant", "status", "approver". The
vocabulary is the domain model; a synonym is a second name for one concept, and
two names is where the divergence starts.

## Before claiming a UI defect is fixed

A class string is not proof and a screenshot of a class string is not proof.
Verify the rendered pixels — see `docs/agents/frontend-drift.md` for the probe
recipe. `capture_screenshot()` returns the same path every call: copy each to a
distinct file immediately or you will analyse one image twice believing you
compared two.
