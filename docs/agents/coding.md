# Coding conventions

Implementation-time rules: how to write code in this repo. Review-time rules
live in `CODING_STANDARDS.md`.

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

## Confirm the tree is yours before trusting a per-arm result

Before trusting any measurement in a worktree you do not exclusively own, run
`git status --porcelain` and confirm it is clean, and re-read any file you wrote
earlier in the session before committing it. A concurrent agent can rewrite your
work mid-task, and a mutation experiment that "passed" may have been masked by
someone else's red.
