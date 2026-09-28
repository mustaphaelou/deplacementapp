# Frontend drift automation

The UI/UX sweep was run by hand — three sessions in a row, one page family at a
time, each pass a human reading class strings against a locked spec living in a
different document. This is the part of that judgement that is decidable from
the source, automated.

## Run it

```bash
npm run frontend:drift          # findings, exit 1 on drift
npm run frontend:drift -- --census   # + the ink-tint duplication census
```

## Where it runs

| Surface | What it does | Blocks? |
| --- | --- | --- |
| `verify` in `docker-publish.yml` | runs on every PR | **yes** |
| `frontend-sweep.yml` | Mondays 06:37 UTC + manual dispatch | no — reports, and files one de-duplicated `ready-for-agent` issue |

The scheduled sweep is a **separate workflow on purpose**. A `schedule:`
trigger added to `docker-publish.yml` fires *every* job in that file, and
`publish-check` / `build-and-push` only exclude `pull_request` — a weekly cron
would have pushed images to GHCR and re-tagged `latest` every Monday, outside
the release ritual ADR-0015 defines. `frontend-sweep.yml` has no `deploy` job
and no registry credentials; it can only read the repo and write a report.

## The rules, and what authorises them

Each rule cites a decision that was actually made. A rule that cannot cite its
authority does not belong in the set.

| Rule | Catches | Authority |
| --- | --- | --- |
| `RULE_TITLE_RESPONSIVE` | `text-[40px]` with no `md:` twin — desktop size at every width | #185, #254 |
| `RULE_HEADER_ADOPTION` | a dashboard route that hand-rolls `<h1>` instead of the shared module | #261–#264 |
| `RULE_FOCUS_RING` | `outline-none` with no `focus-visible:ring` — UA indicator removed, nothing replaced | #252 |
| `RULE_OUTLINE_HAIRLINE` | bare `outline` used as a hairline; it paints unconditionally in Tailwind v4 | #252 |
| `RULE_RADIUS_SCALE` | radius above the 3px spec in page-level code | #171 |
| `RULE_INK_TINT_RATCHET` | the row-hover tint literal spreading to a *new* file | #251 handoff |

## Two traps this file exists to avoid

Both were found by running the checker against the real tree, not by reasoning
about it. They are the reason the rules are this narrow.

**1. `rounded-lg` is 3px in this app, not 8px.** `app/globals.css` sets
`--radius: 0.1875rem` and maps `--radius-lg: var(--radius)`. The ~30
`rounded-lg` uses across `components/ui/*` are therefore **correct**. The
obvious rule — "flag radius classes that don't match the spec" — would have
filed ~30 false tickets on its first run. `components/ui` is excluded wholesale
and the radius scale is treated as remapped, not as shadcn defaults.

**2. A missing `focus-visible:ring` is usually not a defect.** An early version
of `RULE_FOCUS_RING` flagged any control with a hover style and no explicit
ring, and produced six false positives on a clean tree — a `<Link>` with
`hover:text-foreground` and no `outline-none` keeps the browser's default focus
ring, which is a working indicator. The real #252 defect is the inverse:
`outline-none` with nothing put back. The rule was inverted to match, and the
tree has **zero** true findings on this axis.

Also: the hover-reveal chevrons in `sidebar.tsx` and `dashboard-layout.tsx` carry
no `sm:` fallback and are **not** drift — `variant-a.tsx` has the identical
class. Only the table-row chevrons need the touch fallback (#253).

## How a rule is proved

`scripts/frontend-drift.test.ts` copies the live `app/` + `components/` tree into
a temp dir, injects each defect class, and asserts the rule fires — and asserts
the inverse shapes stay silent. Fixtures are built from the real tree rather
than hand-written stubs, so a rule cannot pass because a minimal stub happens to
satisfy it.

Two of those tests are explicit regression pins, each written after the checker
got it wrong:

- a `cn()` call with the ring three lines below the tag — a `/<button[^>]*>/`
  matcher stops at the `=>` arrow and never sees it, so it flagged a correct
  control. The checker walks the tag to its balanced closer instead.
- a route delegating its header to a component — resolving only the route's own
  source reported it as having no header at all.

**If a finding looks wrong, it probably is.** Check `OUT_OF_SCOPE` /
`ALLOWLIST` in `scripts/frontend-drift.mjs` before changing app code, and cite
the deciding issue if you add an entry. Silence is the correct output for a
checker that cannot prove drift.

## The ratchet

`RULE_INK_TINT_RATCHET` is the one non-gate rule. The `rgba(55,53,47,0.024)` and
`rgba(55,53,47,0.06)` row-hover literals are duplicated across 4 files each
instead of being extracted — real debt, recorded in the #251 handoff as a
deliberate deferral. The rule fails only when the count *grows*, so a new copy
is caught while the existing debt does not sit as a permanent red that trains
everyone to ignore the file. Lower `INK_TINT_BASELINE` as the extraction lands;
never raise it.

## What this does not do

It does not check how anything **looks**. `renderToStaticMarkup` pins class
strings, not the cascade, so a green run proves a class is present and nothing
about the rendered result. The manual light/dark eyeball against
`app/prototype/notion-redesign` that #184 requires is still a human step — see
the `dogfood` and `webui-headless-screenshots` skills.

The judgement half of a sweep — "does this page feel like the approved
direction" — is not mechanised. That stays a ticket.
