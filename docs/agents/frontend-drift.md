# Frontend drift automation

The UI/UX sweep was run by hand — three sessions in a row, one page family at a
time, each pass a human reading class strings against a locked spec living in a
different document. This is the part of that judgement that is decidable from
the source, automated.

## Run it

```bash
npm run frontend:drift          # findings, exit 1 on drift
npm run frontend:drift -- --census   # + the ink-tint and display-constant censuses
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
| `RULE_DISPLAY_CONSTANT_RATCHET` | a class string `components/display.tsx` owns, re-declared in a *new* file | #305, #308 |

## Four traps this gate stays out of

Each is a rule someone could add to this file in a few lines. Each is recorded
here because the *reason* it is absent is not visible from the code, and
rediscovering it costs a session. The first two were found by running the
checker against the real tree rather than by reasoning about it, which is why
they are here and not in a design doc.

1. **A radius rule that ignores the remapped scale.** `app/globals.css` sets
   `--radius: 0.1875rem` (3px) and maps `--radius-lg: var(--radius)`, so all
   ~30 `rounded-lg` uses in `components/ui/*` are **correct**. The obvious rule
   — "flag radius classes that don't match the spec" — would have filed ~30
   false tickets on its first run. `RULE_RADIUS_SCALE` exists precisely to
   encode the remap rather than shadcn's default scale.

2. **The inverted focus-ring rule.** The tempting rule is "flag a control with
   a hover style and no explicit `focus-visible:ring`". It is backwards: a
   `<Link>` with `hover:text-foreground` and no `outline-none` keeps the
   browser's default focus ring, which is a working indicator. An early version
   flagged that inverse shape and produced **six false positives on a clean
   tree** — which is how a checker earns the right to be ignored. The real
   #252 defect is the inverse of the tempting rule: `outline-none` with nothing
   put back. The rule was inverted to match, and the tree has **zero** true
   findings on this axis.

3. **The `components/ui` exclusion itself.** shadcn primitives are out of
   treatment and the directory is excluded wholesale in `OUT_OF_SCOPE`. This is
   not a shortcut for trap 1 — it is the reason trap 1 is survivable. Removing
   the exclusion without first teaching the rules how radius is remapped files
   ~30 tickets at once.

4. **Any rule of the form "no page may contain a class string."** Every page
   contains class strings; that is what markup is. The decidable question is
   never "is there a class string here" but "is this string one the display
   module already owns" — which is what `RULE_DISPLAY_CONSTANT_RATCHET` asks,
   and it only works because it is anchored to specific constants rather than to
   class strings in general.

Also: the hover-reveal chevrons in `sidebar.tsx` and `dashboard-layout.tsx`
carry no `sm:` fallback and are **not** drift — `variant-a.tsx` has the
identical class. Only the table-row chevrons need the touch fallback (#253).

**If a finding looks wrong, it probably is.** Check `OUT_OF_SCOPE` /
`ALLOWLIST` in `scripts/frontend-drift.mjs` before changing app code, and cite
the deciding issue if you add an entry. Silence is the correct output for a
checker that cannot prove drift.

## How a rule is proved

`scripts/frontend-drift.test.ts` copies the live `app/` + `components/` tree into
a temp dir, injects each defect class, and asserts the rule fires — and asserts
the inverse shapes stay silent. Fixtures are built from the real tree rather
than hand-written stubs, so a rule cannot pass because a minimal stub happens to
satisfy it.

`RULE_DISPLAY_CONSTANT_RATCHET` ships with both directions the gate requires,
plus the failure modes that would make it useless:

- **the injected defect fires** — the real `app/(dashboard)/demandes/page.tsx`
  has its `@/components/display` import deleted and the value re-declared
  locally as `FIELD_INPUT`, exactly the shape `profile-edit.tsx` carries today.
  Asserted on the rule name, the constant, *and* the offending path.
- **the importing shape is silent** — a module importing four covered constants
  (two of them zero-baseline) must produce no finding. This is the half that
  catches a rule matching on the constant's *name* or on the import line rather
  than on its value.
- **files, not occurrences** — five more `fieldLabelClass` sites are added to a
  file that already holds it; the occurrence count moves, the file count does
  not, and the rule must stay quiet. An occurrence-counting implementation
  reports 11 against a baseline of 2 on the *clean* tree.
- **a new file does fire** — the other direction, on a zero-baseline constant.
- **the module is not judged against itself** — `components/display.tsx` holds
  every one of these strings by definition, the same bug
  `RULE_HEADER_ADOPTION` documents for `page-header.tsx`.
- **a dangling ratchet entry fails** — if a covered constant is renamed or
  deleted in the module, the rule reports the dangling reference instead of
  silently ceasing to watch that geometry.
- **an unclassified export fails** — a new constant in the module that is
  neither ratcheted nor excluded is reported by name. This is the rule's own
  named failure mode — a silently smaller rule set — and it is what keeps
  `DISPLAY_CONSTANT_EXCLUDED` load-bearing rather than decorative.

Each of those seven was mutation-tested: breaking the rule in the corresponding
way — not skipping the module, matching the name instead of the value, counting
occurrences, deleting the rule outright — makes the matching proof fail. A proof
that cannot fail proves nothing.

Some of those tests are explicit regression pins, written after the checker got
something wrong:

- a `cn()` call with the ring three lines below the tag — a `/<button[^>]*>/`
  matcher stops at the `=>` arrow and never sees it, so it flagged a correct
  control. The checker walks the tag to its balanced closer instead.
- a route delegating its header to a component — resolving only the route's own
  source reported it as having no header at all.
- `isAllowlisted` falling back to testing whether an ALLOWLIST *key* appeared as
  a substring of a line of source (#322) — an unreachable branch that read to a
  maintainer as "add a glob here".

## The two ratchets

Neither ratchet is a gate. Both fail only when a count *grows* past a recorded
baseline, so a new copy is caught while the existing debt does not sit as a
permanent red that trains everyone to ignore this file. Every baseline only
ever moves **down**.

**`RULE_INK_TINT_RATCHET`** — the `rgba(55,53,47,0.024)` and
`rgba(55,53,47,0.06)` row-hover literals, duplicated instead of extracted: real
debt, recorded in the #251 handoff as a deliberate deferral. #308 lowered the
baselines to what the census actually reports, and **the two tints moved
differently**:

| literal | baseline | where |
| --- | --- | --- |
| `rgba(55,53,47,0.024)` | 4 → **1** | `components/dashboard-layout.tsx` keeps a private `rowHover` |
| `rgba(55,53,47,0.06)` | **4**, unchanged | `demandes/page.tsx`, `sidebar.tsx`, `theme-toggle.tsx`, `dashboard-layout.tsx` — four files. The baseline counts files, but the debt is larger than the count: `sidebar.tsx` alone holds **7 occurrences** across 4 lines (68, 188 ×2, 197 ×2, 203 ×2). |

The `0.06` tint is deliberately *not* part of the display module's
`rowHoverInkTint` — that constant is the `0.024` literal, and `display.tsx`
says in as many words that the darker tint is a different decision, marking the
actionable cell inside a row. Lowering its baseline to the number the extraction
"ought" to have produced would make the ratchet fire on a correct tree. **The
census is the authority, not the extraction's ambition** — re-read it
(`--census`) rather than predicting the number.

**`RULE_DISPLAY_CONSTANT_RATCHET`** — a class string `components/display.tsx`
owns must not be re-declared in a *new* file. The unit is **distinct files**,
not occurrences: `fieldLabelClass` is spelled eleven times across two files and
that is still two.

Its baseline is **not zero**, and the reason is a known gap, not an oversight.
Spec #305's extraction is **4 of its 7 surfaces**. #307's own ticket named the
profile form, the DemandeDeallocation form and the DemandeDeallocation detail
view as part of its batch, and none of those three files imports anything from
`@/components/display` today — they hold private copies of `textInputClass`,
`fieldLabelClass` and `sectionHeadingClass`. `components/dashboard-layout.tsx`
adds a fourth, a private `rowHover`. None of the three has a `.test.tsx` **of its
own**, but they are rendered by their pages' suites, and those suites do pin part
of the geometry: `demandes/[id]/page.test.tsx:206-207` and
`profil/page.test.tsx:124-125` both assert `uppercase tracking-[0.06em]` and
`bg-border` — the section heading and its hairline. What no test pins is the
copies those modules carry for `textInputClass` and `fieldLabelClass`, so the
"ratchet rather than a test" conclusion holds on the unpinned half and not on the
whole: two of the three private copies here are unobserved by any test today. Lower each baseline
as #307's open edge lands; never raise one.

Baselines, as of #308:

| constant | baseline | note |
| --- | --- | --- |
| `textInputClass` | 2 | `profile-edit.tsx`, `demande-form.tsx` |
| `sectionHeadingClass` | 3 | the unmigrated trio, inline on an `<h2>` |
| `sectionHeadingRuleClass` | 3 | the same trio's hairline |
| `fieldLabelClass` | 2 | 11 sites across those 2 files |
| `rowHoverInkTint` | 1 | `dashboard-layout.tsx`'s private `rowHover` |
| `searchFieldIconClass` | **0** | zero baseline — fires on the first copy |
| `tableShellClass` | **0** | zero baseline |
| `fieldHintClass` | **0** | zero baseline |
| `searchFieldInputClass` | **0** | zero baseline |

A zero baseline is the strongest form the rule takes: those four runs have no
copy outside the module today, so the ratchet fires on the *first* one rather
than waiting for the second.

### What the display ratchet does not cover, and why

A constant is covered when a hit on it would be a hit **on that thing**. The
finding's advice is "import the constant instead of copying its class string",
and that advice is only correct when the file that matched really is holding a
copy of *that* constant's subject. `fieldHintClass` is the labelled field's
hint beneath the control, so anything spelling `mt-1.5 text-xs
text-muted-foreground` there **is** the hint. `loadingTextClass` is the centred
loading block's word, so a muted paragraph elsewhere is **not** the loading
block — the advice would be wrong, and a rule that gives wrong advice is how a
checker gets ignored.

Token document frequency across the judged tree is the supporting evidence for
each call, not the definition of it. Five constants are deliberately excluded:

| constant | why it is excluded |
| --- | --- |
| `loadingTextClass` | `text-sm text-muted-foreground` (`text-sm` in 13/28 judged files, `text-muted-foreground` 12/28). Ten files spell it, including `components/page-header.tsx` and five dashboard pages with no connection to the display module. This is how the app writes small muted text. |
| `loadingBlockClass` | `flex items-center justify-center p-8` (`flex` 18/28 by token boundary — 19 by raw substring — `items-center` 18/28, `justify-center` 11/28). `administration/societe/page.tsx` already spells this exact centred-box idiom as `...p-12` — which `display.tsx` documents as a *deliberately different* block. A `p-8` hit is a coincidence at least as likely as a copy. |
| `sectionHeadingRowClass` | `flex items-center gap-3` (`flex` 18/28, `items-center` 18/28). The app's ordinary flex row. |
| `propertyLabelClass` | `text-xs text-muted-foreground` (`text-xs` 11/28). A two-token slice of the run above. |
| `propertyValueClass` | `mt-0.5 text-sm font-medium` — only `mt-0.5` is rare (2/28); `text-sm` 13/28 and `font-medium` 15/28 are the two most-used type tokens in the tree. |

Adding a name to that list in the script is a judgement call and must carry its
measurement — see `DISPLAY_CONSTANT_EXCLUDED`, where each reason is written out
with its numbers so the call can be re-checked rather than re-argued.

### Two limits worth stating plainly

**It matches an exact string.** The rule asks "does this file contain these
class tokens, contiguously, in this order" — the same limitation the ink-tint
ratchets already have. The same utilities written in a different order are
**not** caught. `display.tsx` normalises token order in exactly one place
(`sectionHeadingClass`), so a hand-written copy that happens to be ordered
differently reads as clean. That is a deliberate trade: order-insensitive
matching would match the surrounding class run and drag in unrelated elements.
It also matches *text*, not code, so a class string quoted inside a comment
counts as a hit.

There is a third blind spot, and it is the one to watch: the rule reads the
module's values with `/export const (\w+)\s*=\s*\n?\s*"([^"]*)"/`. All 14
current exports match. An export written as a **template literal** or as string
concatenation would match neither that pattern nor the unclassified-export guard
below — so it would be unwatched *and* unreported as unclassified, which is
exactly the silent-shrinking failure this rule exists to prevent. The module's
style makes it unlikely; a maintainer adding an export must keep it a plain
string literal or extend the pattern.

**It is a ratchet, not a proof of absence.** A green run means **"no NEW
copy"** — never "no copy". Three files still hold private copies of the display
constants today and the gate is green on purpose, as does one file for the
`0.024` tint. Read `--census` when you want the truth about the tree rather
than the truth about the trend.

## What this does not do

It does not check how anything **looks**. `renderToStaticMarkup` pins class
strings, not the cascade, so a green run proves a class is present and nothing
about the rendered result. The manual light/dark eyeball against
`app/prototype/notion-redesign` that #184 requires is still a human step — see
the `dogfood` and `webui-headless-screenshots` skills.

The judgement half of a sweep — "does this page feel like the approved
direction" — is not mechanised. That stays a ticket.
