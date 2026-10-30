# Handoff — sweep every page for UI/UX consistency with the approved Notion direction

> **This document was corrected under #257 (part of spec #251).** An earlier
> version of this handoff made three claims that were false by the time it was
> read. They are called out inline below with what is true instead. If you are
> about to act on anything here, read the corrections first.

## Goal / next-session focus

The page-by-page sweep is **done**. Every dashboard page now carries the shared
page header (breadcrumb row, icon tile, title, actions top-right), the hairline
table surface, and the 3px-radius quiet palette from #171 Variant A.

Spec **#251** ("close the UI/UX sweep") is the last piece: four craft debts that
no ticket owned, plus the dead code the sweep left behind. Its tickets are
**#252** (focus ring on *Accès rapide*), **#253** (touch-reachable rows),
**#254** (responsive header — home + demandes list, the reference
implementation), **#255** (stat row palette), **#256** (delete dead components),
**#257** (this document) and **#258** (responsive header on the remaining seven
pages, blocked by #254 so it copies a settled class set rather than re-deriving
one).

**Do not re-litigate the design direction.** Every visual decision below was
decided in closed issues. This is a consistency sweep, not a design brainstorm.

## Status

- **Spec #249 / PR #250 — MERGED** (`3bf7460`). The home page
  (`components/dashboard-layout.tsx`) matches `/demandes`: breadcrumb + 48px icon
  tile + 40px/700 title, hairline database table, `StatusPill` rows, hairline
  quick-access panel, quiet empty state.
  `components/demande-status-badge.tsx` was deleted.
- **All #169 map tickets CLOSED** (172–177, 183–186). Nothing left to decide.
- **#191 CLOSED** — the form, detail **and profile** pages were restyled. The
  profile page is finished; it is no longer outstanding work. See Correction 2.
- **Spec #251 — IN PROGRESS** on branch `impl/251-ui-ux-sweep-closeout`. Tickets
  #252–#257 implemented; #258 follows #254.
- Baseline at the start of #251: typecheck clean, lint 0 errors / 3 pre-existing
  `no-img-element` warnings, **759 passed / 8 skipped** across 76 files. (The
  709/72 figure in the previous version of this handoff was stale — the repo had
  grown since #249 merged.)

### The two open defects from the #249 review — now owned

Both were real and both are now ticketed under #251. They are described here
because the *reasoning* is still worth keeping, not because they are unowned.

1. **Keyboard focus was suppressed on the quick-access links.** The cell used
   `outline outline-border outline-offset-[-1px]` to draw a 1px hairline.
   Tailwind v4 emits `.outline { outline-style: var(--tw-outline-style);
   outline-width: 1px }` where `--tw-outline-style` has `initial-value: solid` —
   so the outline is *always* solid, not only on focus. Tabbing to *Accès rapide*
   showed a static hairline identical to the resting state. The app-wide pattern
   is `outline-none focus-visible:ring-2 focus-visible:ring-ring` (see
   `sidebar.tsx`, `theme-toggle.tsx`, `demandes/page.tsx`).
   **Owned by #252.** The non-obvious part: `outline-none` would have erased the
   hairline divider along with the broken outline. Tailwind composes one
   `box-shadow` from five custom-property slots — `var(--tw-inset-shadow)`,
   `var(--tw-inset-ring-shadow)`, `var(--tw-ring-offset-shadow)`,
   `var(--tw-ring-shadow)`, `var(--tw-shadow)` — and `ring-*` writes
   `--tw-ring-shadow` while `shadow-*` writes `--tw-shadow`. Moving the divider
   to `shadow-[inset_0_0_0_1px_var(--color-border)]` frees the ring slot and
   keeps the rendered 1px geometry identical.
2. **Row chevron invisible on touch.** `/demandes` uses
   `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` (visible by default,
   hidden only on hover-capable pointers). The home page had dropped that
   fallback, and since #249 the `numero` cell is a plain `<span>` — so on a
   phone the row was unreachable. **Owned by #253**, which copies the list
   page's exact triple. The `numero` cell deliberately stays a plain span;
   making the whole row a link target is out of scope.

### Correction 1 — the stat-row follow-up WAS filed, under #255

The previous version of this handoff said #249's stat-row item was declined and
that a follow-up was "flagged as a follow-up" but unfiled, leaving it to the
next agent to decide. **That was accurate at the time** — no such issue existed,
verified against all open and closed issues — but it has since been resolved.

The follow-up is now **#255 — "Stat row in the 3px palette"**, filed under spec
#251 and implemented on the `impl/251-ui-ux-sweep-closeout` branch.

One correction inside #255's own premise, worth carrying forward: the ticket
described the stat tile as using `rounded-lg` "(8px)". **It rendered 3px all
along.** `app/globals.css` sets `--radius: 0.1875rem` (= 3px) and maps
`--radius-lg: var(--radius)`, and `.rounded-lg` emits
`border-radius: var(--radius)`. There is no literal 8px radius anywhere in the
compiled stylesheet. Spelling it `rounded-[3px]` is still the right call — it is
explicit and theme-proof rather than dependent on the radius scale staying at
3px — but it changes nothing at render time. The part that does change the type
is the value weight, `font-semibold` (600) → `font-medium` (500).

### Correction 2 — `/profil` is finished, and `Avatar`/`Badge` are not holdouts

The previous version described `app/(dashboard)/profil/page.tsx` as still
carrying a gradient hero and listed it as likely remaining work, and it called
`Avatar` and `Badge` "the two last shadcn-chrome holdouts in the app", with
deleting both "depending on finishing `profil`".

**All of that is wrong**, verified against the current file:

- There is **no gradient hero** — `grep -n gradient components/profile-edit.tsx`
  returns nothing. The flat header, the borderless stats and the hairline-ruled
  sections all landed under **#191** (closed).
- `Avatar` and `Badge` are **spec'd features, not leftover chrome**. #176
  specifies an avatar, a name, a poste and a département badge in the profile
  header, and that is exactly what the code renders. Both have live consumers:
  `Badge` in `components/demande-detail.tsx` and `components/profile-edit.tsx`,
  `Avatar` in `components/profile-edit.tsx`. **Do not delete them.** An earlier
  characterisation of them as removable shadcn chrome was a misreading; acting
  on it would have deleted specified UI.
- One real asymmetry, for whoever does #258: `profile-edit.tsx` is the only
  page header with **no icon tile** — its `h1` sits directly in a
  `min-w-0 flex-1` block. Apply the responsive title classes there; do not
  invent a tile that does not exist.

### Correction 3 — `/login` is governed by #245, not #173

The previous version advised verifying `app/(auth)/login/page.tsx` against #173
and, in the page inventory, "check against #173 (centred column anatomy, not
page-header)".

**Do not do that.** **#245 re-specified `/login` to the Cloudflare sign-in and
supersedes #173.** Following the #173 advice would move the page backwards. The
file says so itself, at the top: `Cloudflare sign-in geometry (#245): 36px
controls, 1px hairline borders, 5px radius, 13px text`, with the focus ring
taking the Societe's `couleurPrimaire` through `--brand`. The login page is out
of scope for #251 and for the Notion treatment entirely.

The same applies to `app/(protected)/403/page.tsx` — out of scope for #251.

## Key decisions & constraints (all pre-decided — do not revisit)

- **Direction:** Notion classique, HITL-approved 2026-08-03. Locked spec:
  `app/prototype/notion-redesign/PROTOTYPE-NOTES.md`. Reference route
  `/prototype/notion-redesign?variant=A&surface=login|liste|formulaire`.
  Token provenance: `docs/research/notion-design-language.md`.
- **Scope rule:** layout and craft may change; **behaviour and features stay
  identical.** Dark mode stays.
- **Accent is `couleurPrimaire`**, not Notion blue — the runtime `--brand`
  CSS-var seam.
- **Verification is two-layer, zero new tooling** (#184): per-ticket structural
  vitest anatomy assertions (existing `renderToStaticMarkup` pattern) + a manual
  light/dark eyeball vs the prototype, human sign-off before close.
  Playwright/screenshot diffing is explicitly ruled out.
- **Broken-test triage is a three-way split** (#184): spec-changed markup →
  deliberate same-commit test update that preserves intent; behaviour break →
  fix the code; **never update a green test without classifying it first**, and
  note the classification. Execution tickets may not weaken data/redirect
  assertions.
- **Responsive (#185):** desktop anatomy is never altered below breakpoints —
  columns collapse, nothing restructures. `md:` is the single shell breakpoint.
  Title 24px below `md:` → 40px from `md:`; icon tile 40px below `md:` → 48px
  from `md:` up (the tile shrinks as the title shrinks, so the header does not
  grow on a phone); 44px mobile touch targets on icon buttons. Card-ify
  rejected. **Implemented by #254 (reference) and #258 (the other seven).**
- **`mt-6` header spacing is a SETTLED CHOICE, not drift.** The prototype
  specifies `mt-8`. Nine of the ten header blocks across the app use
  `mt-6 flex items-center gap-4` (verified across `dashboard-layout.tsx`,
  `demande-form.tsx`, `demande-detail.tsx`, the notifications page, the
  demandes list page and the four administration pages); the tenth,
  `profile-edit.tsx`, is the #191 flat header with no tile. Uniform `mt-6` reads
  as a deliberate settled choice. **Do not "fix" it to `mt-8`.**
- **4-gate Done when** (per #184): anatomy tests + lint/typecheck/vitest green,
  triage noted, visual sign-off, behaviour identical.

## Immediate next steps

1. **Finish #258** — copy #254's class set verbatim to the remaining seven page
   headers. Read `git show impl/251-ticket-254:components/dashboard-layout.tsx`
   and copy it; do not re-derive. The breadcrumb needs all four parts
   (`min-w-0` on the nav, `flex-nowrap` on the list, `min-w-0` on the last item,
   `truncate` on the page) because a flex item's default `min-width: auto`
   refuses to shrink below its content. `cn()` is `twMerge`, so `flex-nowrap`
   genuinely overrides the primitive's hardcoded `flex-wrap`.
2. **Run the two-layer verification by eye** — light and dark, phone and desktop
   widths, against the prototype. This has not been done by a human yet and the
   spec requires sign-off before close. A green test proves a class string is
   present, never how it looks.
3. **Nothing else is outstanding.** Every page carries the geometry. Do not go
   looking for more drift; if you find something genuinely new, file it rather
   than folding it into #251.

### Page inventory (all swept)

Fully swept — breadcrumb + 40px title + 48px icon tile + hairline table, from
the #171/#249/#191/#192 work:

| Page family | Header lives in |
|---|---|
| Home | `components/dashboard-layout.tsx` |
| Demandes list | `app/(dashboard)/demandes/page.tsx` |
| Demande detail | `components/demande-detail.tsx` |
| Nouvelle demande | `components/demande-form.tsx` |
| Profil | `components/profile-edit.tsx` (no icon tile — see Correction 2) |
| Notifications | `app/(dashboard)/notifications/page.tsx` |
| Administration ×4 | `app/(dashboard)/administration/{rapports,societe,utilisateurs,vehicules}/page.tsx` |

Out of treatment by decision: `app/(dashboard)/demandes/[id]/imprimer` + the
PDF stay formal documents (#176); `app/(auth)/login` follows #245 (see
Correction 3); `app/(protected)/403` is out of scope for #251.

### Dead code

`components/ui/{table,card,empty}.tsx` had **zero consumers** and are **deleted**
by **#256**. `components/ui/badge.tsx` and `components/ui/avatar.tsx` are
**retained and are spec'd** (see Correction 2) — they are not dead code.
`components/ui/sheet.tsx` never existed as a file; there was nothing to delete.
`components/ui/dashboard-card.tsx` is a different, live component and must not be
confused with the deleted `ui/card`.

## Artifacts (reference, don't paste)

- Locked spec: `app/prototype/notion-redesign/PROTOTYPE-NOTES.md`
- Reference implementation: `app/prototype/notion-redesign/variant-a.tsx`
- Notion token research: `docs/research/notion-design-language.md`
- Parent map: issue #169 (closed) — its "Decisions so far" section summarises
  every spec ticket
- Spec tickets: #172 tokens, #173 auth (superseded by #245 for login), #174
  shell, #175 list pages, #176 form/detail, #177 administration, #183 component
  set, #184 verification, #185 responsive, #186 tests
- Execution tickets: #191 form/detail/profil, #192 administration, #245 login,
  #249 home page
- Active spec: **#251**, tickets #252–#258
- Merged home-page work: `git show 3bf7460`
- Domain language: `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, `docs/adr/`
- Issue tracker conventions: `docs/agents/issue-tracker.md`

## Gotchas learned the hard way

- **Tailwind v4 `outline` is not a border, and not a focus indicator.** Bare
  `outline` sets `outline-style: solid` + `outline-width: 1px` via
  `@property --tw-outline-style` initial-value — it paints unconditionally. To
  verify what a class actually emits, compile a probe against the app's real
  stylesheet: a PostCSS pass with `@tailwindcss/postcss` over a css file that
  does `@import "<abs path>/app/globals.css"; @source "<probe.html>";`. A bare
  `@import "tailwindcss"` probe will **not** resolve theme tokens like
  `outline-border` or `--radius`. `scripts/` is the right home for such a
  one-off; do not leave probe output in the repo.
- **Never invoke `./node_modules/.bin/*` directly** on this host — a gateway
  guard fails closed on it. Use `npm run <script>`, or
  `node node_modules/<pkg>/<entry>` for a one-off.
- **The render suite has no CSS engine.** `renderToStaticMarkup` tests pin class
  *strings*, not the cascade. Any claim about how something *looks* is verified
  by eye against the prototype, never by a passing test.
- **A substring pin can silently pass on the wrong thing.**
  `expect(html).toContain("text-[40px]")` also passes on `md:text-[40px]`, so it
  cannot catch a half-applied responsive rule. #254 pins the full class
  attribute on both sides of the breakpoint instead.
- **Lucide prepends its own classes**, so a rendered element's class attribute
  does not start with the class you wrote — a `class="size-3.5 …"` assertion
  fails against `<svg class="lucide lucide-chevron-right size-3.5 …">`. Match
  the class run without a `class="` anchor.
- **`rounded-lg` is 3px in this app, not 8px.** See Correction 1. The radius
  scale is remapped in `app/globals.css`; do not assume shadcn's defaults.
- `rowHover` / the ink-tint constants are duplicated as literals across 4 files
  (`demandes`, `administration/vehicules`, `administration/utilisateurs`,
  `dashboard-layout`). Changing the hover treatment means touching all four — a
  candidate for extraction, deliberately out of scope for #251.
- **Parallel agents appending to one test file conflict destructively.** When
  #252, #253 and #254 each appended a `describe` block to
  `components/dashboard-layout.test.tsx`, git's conflict marker split a block
  and left an unbalanced brace — a file that parsed as truncated. After any
  hand-resolved merge, run the file's tests and verify no branch's lines were
  dropped; do not trust the merge to be clean.

## Suggested skills

- `code-review` — two-axis (Standards / Spec) review of a branch against a fixed
  point.
- `regression-test-proving` — before claiming a fix ships.
- `dogfood` / `webui-headless-screenshots` — the light/dark eyeball pass #184
  requires, if you want rendered evidence before the human sign-off.
- `tdd` / `test-driven-development` — for the anatomy pins.

## Constraints for the next agent

- **This is now an implementation task, not a read-only review.** The previous
  session was a review and was forbidden from editing; that framing is stale.
  #251's remaining work (#258, and the visual sign-off) requires editing.
- Repo: `/opt/data/work/deplacementapp`. Single-context repo — domain terms are
  Utilisateur, DemandeDeplacement, Etape, IdentiteVisuelle, couleurPrimaire. Use
  canonical role names as-is for labels.
- Stack: Next.js App Router, shadcn/ui (base-nova), Tailwind v4, lucide,
  next-themes.
- Tests: `npm test` (vitest), `npm run typecheck`, `npm run lint`.

## Session metadata

- Topic: Telegram group `hermes-elouardi`, thread 3360.
- Original audit: 2026-09-26. Corrected under #257 on the same day.
- Workspace: `/opt/data/work/deplacementapp`; this handoff at
  `.hermes/handoffs/all-pages-ui-ux-sweep.md`.
- Active profile: `default`.
- No secrets or credentials recorded in this document.
