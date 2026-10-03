/**
 * Frontend drift checker — machine half of the UI/UX sweep automation.
 *
 * The UI/UX sweep (#251 and its tickets) was run by hand, three sessions in a
 * row, and every finding was a human reading class strings against a locked
 * spec in another document. This encodes the parts of that judgement that are
 * *decidable from the source*, so a regression is caught by `npm run
 * frontend:drift` instead of by the next session noticing.
 *
 * ## Why this is a narrow ruleset and not a class-string linter
 *
 * The obvious version — "flag any class that differs from PROTOTYPE-NOTES" —
 * produces ~30 false positives on its first run against this app. `app/globals.css`
 * remaps the radius scale (`--radius: 0.1875rem` = 3px, `--radius-lg: var(--radius)`),
 * so all 30 `rounded-lg` uses in `components/ui/*` are CORRECT and a naive
 * "rounded-lg means 8px" rule would file a ticket against each one. Same trap
 * with the hover-reveal chevrons: the sidebar ones carry no `sm:` fallback and
 * that is the prototype's own geometry, not drift.
 *
 * So every rule below is anchored to a decision that was actually made, and
 * anything out of scope by decision is an explicit allowlist entry with the
 * issue that scoped it. A rule that cannot cite its authority does not belong
 * here. Unknown surfaces are left alone: silence is the correct output for a
 * checker that cannot prove drift.
 *
 * ## Ratchet, not gate
 *
 * RULE_INK_TINT_RATCHET and RULE_DISPLAY_CONSTANT_RATCHET are ratchets: they
 * fail only when the known duplication GROWS past the recorded baseline. The
 * existing duplication is real debt — the #251 handoff flags the ink tints as a
 * candidate for extraction, deliberately deferred, and the display module's own
 * extraction (#305) is only 4 of its 7 surfaces — and blocking the suite on it
 * would be a permanent red that trains everyone to ignore this file. Every
 * baseline only ever moves down.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Directories the sweep never judges: the prototype is a reference, not app code. */
const EXCLUDED_DIRS = ["prototype", "node_modules", ".next", ".git", ".hermes"]

/**
 * Surfaces excluded BY DECISION, with the authority for each exclusion.
 * Adding a path here is a design statement — carry the issue number.
 */
const OUT_OF_SCOPE = {
  // #245 re-specified login to Cloudflare geometry; #173 is superseded.
  "app/(auth)/login": "#245 supersedes #173 for the login page",
  // #176 keeps print/PDF as formal documents, outside the Notion treatment.
  "app/(dashboard)/demandes/[id]/imprimir": "#176 keeps print/PDF formal",
  // Excluded by #251.
  "app/(protected)/403": "out of scope for #251",
  // shadcn primitives, judged out of treatment; the 3px radius scale is remapped
  // in globals.css so rounded-lg here is correct, not drift.
  "components/ui": "shadcn chrome, out of treatment",
}

const ALLOWLIST = {
  /**
   * RULE_TITLE_RESPONSIVE — a bare `text-[40px]` with no `md:` twin is the
   * desktop size applied unconditionally. 403 owns one by decision.
   */
  "RULE_TITLE_RESPONSIVE": {
    "app/(protected)/403/page.tsx": "403 is out of scope for #251",
  },
  /**
   * RULE_RADIUS_SCALE — a radius above 3px in page-level code. `rounded-full`
   * (pills, avatars) and `rounded-lg` (3px here, via the remapped scale) are
   * both correct and are not flagged. `components/ui` is excluded wholesale.
   */
  "RULE_RADIUS_SCALE": {
    "app/(auth)/login/setup-wizard.tsx":
      "wizard is the login surface; governed by #245, not the dashboard radius scale",
  },
  /**
   * RULE_HEADER_ADOPTION — components/profile-edit.tsx hand-rolls a header that
   * mirrors the shared geometry. The #251 handoff (Correction 2) examined this
   * and decided NOT to invent an icon tile that does not exist, leaving the
   * block as the #191 flat header. Accepted deviation, not open drift.
   */
  "RULE_HEADER_ADOPTION": {
    "components/profile-edit.tsx":
      "flat header with no icon tile, accepted by decision in the #251 handoff Correction 2",
  },
}

/**
 * Baseline for RULE_INK_TINT_RATCHET, in DISTINCT FILES per tint literal.
 *
 * These literals are duplicated rather than extracted, so changing the row
 * hover treatment means touching every file listed here. The handoff records
 * this as a deliberate deferral. The ratchet fails only if the count rises —
 * i.e. a NEW file copies the literal instead of the constant being extracted.
 * Lower this number as the extraction lands; never raise it.
 *
 * Lowered to the census in #308, after the #307 migration:
 *
 *   `0.024`  4 -> 1  — components/dashboard-layout.tsx:50 keeps a private
 *                      `rowHover`. It imports `hideClassFor` and
 *                      `tableShellClass` but not `rowHoverInkTint`; migrating
 *                      that one is #307's open edge, not a reason to keep a
 *                      baseline that no longer describes the tree.
 *   `0.06`   stays 4 — this tint is NOT part of the display module's
 *                      `rowHoverInkTint` (which is the 0.024 literal). It lives
 *                      in the sidebar, the theme toggle, the Demandes list and
 *                      dashboard-layout, four files, and `components/display.tsx`
 *                      deliberately does not own it. Lowering it to the number
 *                      the extraction "ought" to have produced would make the
 *                      ratchet fire on a correct tree — the silent hole this
 *                      rule exists to avoid. The census is the authority, not
 *                      the extraction's ambition.
 */
const INK_TINT_BASELINE = {
  "rgba(55,53,47,0.024)": 1,
  "rgba(55,53,47,0.06)": 4,
}

/** The shared display module, and the only file allowed to hold these strings. */
const DISPLAY_MODULE = "components/display.tsx"

/**
 * RULE_DISPLAY_CONSTANT_RATCHET — baseline in DISTINCT FILES per constant
 * outside DISPLAY_MODULE. The unit is files: `fieldLabelClass` appears eleven
 * times across two files and that is still two.
 *
 * ## Ratchet, not gate, and the baseline is NOT zero
 *
 * Same reasoning as the ink tints, and the same reason these numbers are
 * measured rather than aspirational: spec #305's extraction is 4 of its 7
 * surfaces. #307's own ticket named the profile form, the DemandeDeallocation
 * form and the DemandeDeallocation detail view as part of its batch, and none
 * of those three files imports anything from `@/components/display` today —
 * they hold private copies of `textInputClass`, `fieldLabelClass` and
 * `sectionHeadingClass`. `components/dashboard-layout.tsx` adds a fourth, a
 * private `rowHover` holding `rowHoverInkTint`. That is real debt at a known
 * size; a gate on top of it would be a permanent red that trains everyone to
 * ignore this file. Lower these as #307's open edge lands. Never raise them.
 *
 * ## Which constants, and why the rest are not here
 *
 * The question each constant is put to is: **if this rule fired on a hit,
 * would its advice be right?** The finding says "import the constant instead
 * of copying its class string", and that advice is only correct when the hit
 * really is that constant's thing. `fieldHintClass` is the labelled field's
 * hint under the control, so a hit on `mt-1.5 text-xs text-muted-foreground`
 * in that position IS the hint and the advice is right. `loadingTextClass` is
 * the centred loading block's word, so a hit on an unrelated muted paragraph is
 * NOT the loading block and the advice would be wrong — worse, it would train
 * people to ignore the file.
 *
 * Token document frequency across the judged tree is the supporting evidence,
 * quoted per entry in DISPLAY_CONSTANT_EXCLUDED so each call can be re-checked
 * rather than re-argued. The consequence is the one this file's own header
 * already names: this is where a checker earns the right to be ignored.
 * `loadingBlockClass` is the instructive exclusion —
 * `administration/societe/page.tsx` spells the SAME centred-box idiom one
 * padding step away, `flex items-center justify-center p-12`, which the
 * display module's own comment calls a deliberately different block, so a
 * `p-8` hit is a coincidence at least as likely as a re-declaration. Its
 * neighbour `loadingTextClass` is worse: ten files spell it, including
 * `components/page-header.tsx` and five dashboard pages that have nothing to
 * do with this module.
 */
const DISPLAY_CONSTANT_RATCHET = {
  // 67 chars, 4 tokens; `focus-visible:ring-1` and the brand ring are in 3
  // judged files. Two private copies (#307's open edge).
  textInputClass: 2,
  // 69 chars, 5 tokens — a coincidence needs all five, order included.
  // Three inline <h2> copies in the unmigrated trio.
  sectionHeadingClass: 3,
  // Not a generic class run at all: the 0.024 ink tint plus its dark twin, one
  // file each. `components/dashboard-layout.tsx` keeps a private `rowHover`.
  rowHoverInkTint: 1,
  // 32 chars; `mb-1.5` and `block` are in 3 judged files. Eleven sites, two
  // files.
  fieldLabelClass: 2,
  // 21 chars; `h-px` and `bg-border` are in 3 judged files each. The hairline
  // is only ever spelled as part of the section-heading row.
  sectionHeadingRuleClass: 3,
  // ZERO baselines below. Each of these runs has no copy outside the module
  // today, so the ratchet fires on the FIRST one — the strongest form the rule
  // takes, and the reason a future hand-copy of the search field's own box, its
  // magnifier overlay or its table shell is caught rather than absorbed.
  searchFieldIconClass: 0,
  tableShellClass: 0,
  fieldHintClass: 0,
  searchFieldInputClass: 0,
}

/**
 * The display constants this rule deliberately does NOT cover, with the reason
 * for each. Adding a name here is a judgement that a hit would be a
 * coincidence — carry the measurement that justifies it.
 *
 * Measured token document frequency (files containing the token, of 28 judged
 * `.tsx`) is quoted per entry, so the call can be re-checked rather than
 * re-argued.
 */
const DISPLAY_CONSTANT_EXCLUDED = {
  loadingTextClass:
    "`text-sm text-muted-foreground` (text-sm 13/28, text-muted-foreground 12/28). Ten files spell it, including components/page-header.tsx and five dashboard pages with no connection to the display module. This is how the app writes small muted text; a ratchet here would cry wolf on the tenth unrelated `<p>`.",
  loadingBlockClass:
    "`flex items-center justify-center p-8` (flex 17/28, items-center 18/28, justify-center 11/28). administration/societe/page.tsx already spells this exact centred-box idiom as `...p-12` — which the display module documents as a deliberately different block. A `p-8` hit is a coincidence at least as likely as a re-declaration, so ratcheting it would file a ticket against the next centred spinner.",
  sectionHeadingRowClass:
    "`flex items-center gap-3` (flex 17/28, items-center 18/28). This is the app's ordinary flex row; an unrelated row with a 3-unit gap spells it without any reference to the display module.",
  propertyLabelClass:
    "`text-xs text-muted-foreground` (text-xs 11/28, text-muted-foreground 12/28). A two-token slice of the same run `loadingTextClass` already spells 13 times; the label above a property value is not a distinguishable shape.",
  propertyValueClass:
    "`mt-0.5 text-sm font-medium` — only `mt-0.5` is rare (2/28); `text-sm` is 13/28 and `font-medium` 15/28, the two most-used type tokens in the tree. A small bold paragraph anywhere spells this.",
}

/** Radius utilities that resolve to the 3px spec radius in this app. */
const RADIUS_ALLOWED = new Set(["rounded-[3px]", "rounded-lg", "rounded-sm", "rounded-md", "rounded-none", "rounded-full"])
/** Radius utilities that exceed 3px given globals.css's remapped scale. */
const RADIUS_OVER = /^rounded-(xl|2xl|3xl|4xl)$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.includes(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(full)
  }
  return out
}

function rel(path) {
  return relative(ROOT, path)
}

function isOutOfScope(relPath) {
  return Object.entries(OUT_OF_SCOPE).find(([prefix]) => relPath === prefix || relPath.startsWith(`${prefix}/`))
}

/**
 * Is this file allowlisted for this rule?
 *
 * BY FILE, ONLY. The keys are repo-relative paths and the match is exact.
 * There is deliberately no glob and no source-line fallback: an earlier version
 * fell back to `Object.entries(entries).some(([pat]) => line.includes(pat))`,
 * which tested whether an ALLOWLIST KEY appeared as a substring of a line of
 * source. A key like `app/(auth)/login/setup-wizard.tsx` never appears inside a
 * .tsx line, so that branch was unreachable — it read as "add a glob here" to a
 * maintainer and could never do what it advertised. Add the file path.
 */
function isAllowlisted(rule, relPath) {
  const entries = ALLOWLIST[rule]
  if (!entries) return false
  return Boolean(entries[relPath])
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length
}

/** Every dashboard route, resolved through its delegating component if any. */
function dashboardRoutes(files) {
  const routes = files.filter((f) => f.includes(join("app", "(dashboard)")) && f.endsWith(join("", "page.tsx")))
  return routes.map((route) => {
    const src = readFileSync(route, "utf8")
    // A thin route delegates its header to a component; the component is the
    // real header site. Resolve one level so a delegating route is not
    // reported as a hand-rolled header. Only components that actually render a
    // header (PageHeader or an <h1>) are eligible delegates — resolving to the
    // first `@/components/...` import finds `status-pill` and reports nonsense.
    const candidates = [...src.matchAll(/from "@\/components\/([a-z-]+)"/g)].map((m) => `components/${m[1]}.tsx`)
    const delegate = candidates
      // page-header.tsx is the shared module itself. It is never a *delegate*:
      // it is the definition of the header, so treating it as a hand-rolled
      // route site would flag the source of truth against its own rule.
      .filter((c) => c !== "components/page-header.tsx")
      .filter((c) => files.includes(join(ROOT, c)))
      .map((c) => ({ c, src: readFileSync(join(ROOT, c), "utf8") }))
      .find(({ src: s }) => /<PageHeader[\s>]/.test(s) || /<h1[\s>]/.test(s))
    return {
      route: rel(route),
      component: delegate ? delegate.c : null,
      uses: delegate ? delegate.src : src,
    }
  })
}

/**
 * Extract the class list of a JSX opening tag starting at `start`.
 *
 * A naive `/<button[^>]*>/` breaks on `className={cn(\n  "a",\n  "b"\n)}` — the
 * first `>` it meets is the arrow of `=>`, or the tag's own closer sits several
 * lines after the hover classes, so a rule reads `hover:bg` and never sees the
 * `focus-visible:ring` that answers it. Walk the tag to its balanced closer
 * instead, and only treat what is genuinely inside the tag as its classes.
 */
function openingTagAt(src, start) {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === "{") depth++
    else if (ch === "}") depth--
    else if (ch === ">" && depth === 0) return src.slice(start, i + 1)
  }
  return null
}

/**
 * The enclosing JSX opening tag for the character at `index`, or null.
 *
 * A line-scoped `line.includes("md:text-[40px]")` is wrong for a class list
 * spread over several lines: `<h1 className={cn("text-[40px]",\n "md:text-[40px]")}>`
 * carries a correct md: twin, but the bare token's own line does not contain
 * it, so the rule fired a false positive on exactly the shape it should bless.
 * Find the tag that owns the token and read the twin out of the whole tag.
 */
function enclosingTagAt(src, index) {
  // Walk back to the nearest `<` that opens a tag before the token.
  for (let i = index; i >= 0; i--) {
    if (src[i] !== "<") continue
    // A JSX tag opener is `<` followed by a name/fragment character. Anything
    // else (`<=`, `< 5`, a closing tag already passed) is not our anchor.
    if (!/[A-Za-z>]/.test(src[i + 1] ?? "")) continue
    const tag = openingTagAt(src, i)
    if (tag && tag.includes(">")) return tag
  }
  return null
}

export function runChecks() {
  const files = walk(join(ROOT, "app")).concat(walk(join(ROOT, "components")))
  const findings = []

  for (const file of files) {
    const src = readFileSync(file, "utf8")
    const r = rel(file)

    // RULE_TITLE_RESPONSIVE — 40px must only apply from md: up.
    //
    // The md: twin is read out of the ENCLOSING TAG, not the token's own line,
    // so a `cn()` spread over several lines with a correct twin is silent.
    for (const m of src.matchAll(/text-\[40px\]/g)) {
      const tag = enclosingTagAt(src, m.index)
      // No enclosing tag means the token is not in JSX class position (a
      // constant, a comment). Fall back to the line so the token is still
      // judged rather than silently skipped.
      const scope = tag ?? (src.split("\n")[lineOf(src, m.index) - 1] ?? "")
      if (!scope.includes("md:text-[40px]") && !isAllowlisted("RULE_TITLE_RESPONSIVE", r)) {
        findings.push({
          rule: "RULE_TITLE_RESPONSIVE",
          file: r,
          line: lineOf(src, m.index),
          message: "text-[40px] without an md: twin applies the desktop size at every width (#185/#254)",
        })
      }
    }

    // RULE_RADIUS_SCALE — radius above the 3px spec, in page-level code only.
    //
    // Two shapes are defects and they are DIFFERENT defects, so they get
    // different messages:
    //   1. a named step that exceeds the spec (`rounded-xl` and up) — this is
    //      the ordinary way the scale drifts, and it is what the rule is FOR;
    //   2. an arbitrary value (`rounded-[8px]`) that resolves to nothing the
    //      scale defines.
    // An earlier version tested `RADIUS_OVER.test(token) || RADIUS_ALLOWED...`
    // inside a single `continue`, which exempted shape 1 — the named scale,
    // the common case — and caught only shape 2. The rule reported clean on a
    // tree full of `rounded-xl`. The two shapes are now separate findings.
    if (!isOutOfScope(r)) {
      for (const m of src.matchAll(/rounded-[a-z0-9\[\]-]+/g)) {
        const token = m[0]
        if (RADIUS_ALLOWED.has(token)) continue
        findings.push({
          rule: "RULE_RADIUS_SCALE",
          file: r,
          line: lineOf(src, m.index),
          message: RADIUS_OVER.test(token)
            ? `${token} is above the 3px spec; globals.css remaps the scale, so use rounded-[3px]`
            : `unrecognised radius utility ${token}; the scale is remapped in globals.css (3px)`,
        })
      }
    }

    // RULE_FOCUS_RING — the #252 defect class, stated precisely.
    //
    // The trap is `outline-none` WITHOUT a replacement ring: the author removed
    // the UA focus indicator and put nothing back, so a keyboard user has no
    // focus indicator at all. The inverse is NOT a defect — a control with
    // `hover:text-foreground` and no `outline-none` keeps the browser's default
    // focus ring, which is a working indicator. An earlier version of this rule
    // flagged the inverse and produced six false positives on a clean tree,
    // which is how a checker earns the right to be ignored.
    if (isOutOfScope(r)) continue
    for (const m of src.matchAll(/<(button|a|Link)\b/g)) {
      const tag = openingTagAt(src, m.index)
      if (!tag) continue
      if (!/outline-none/.test(tag)) continue
      if (/focus(-visible)?:ring/.test(tag)) continue
      findings.push({
        rule: "RULE_FOCUS_RING",
        file: r,
        line: lineOf(src, m.index),
        message:
          "outline-none with no focus-visible:ring — the UA focus indicator was removed and nothing replaced it (#252)",
      })
    }

    // RULE_OUTLINE_HAIRLINE — bare `outline` paints unconditionally in Tailwind
    // v4 (--tw-outline-style initial-value: solid). It cannot express a
    // focus-only ring. Use shadow-[inset_...] for a hairline, ring-* for focus.
    for (const m of src.matchAll(/className="([^"]*)"/g)) {
      const classes = m[1]
      if (/(^|[\s"'])outline($|[\s"'])/.test(classes) && !/outline-none/.test(classes)) {
        findings.push({
          rule: "RULE_OUTLINE_HAIRLINE",
          file: r,
          line: lineOf(src, m.index),
          message: "bare `outline` renders a permanent 1px ring; it is not a focus indicator (#252)",
        })
      }
    }
  }

  // RULE_HEADER_ADOPTION — a dashboard route must reach the shared PageHeader,
  // directly or through its component. A new page that hand-rolls an <h1> is
  // the drift this automation exists to catch.
  for (const { route, component, uses } of dashboardRoutes(files)) {
    if (isOutOfScope(route)) continue
    const target = component ?? route
    if (isAllowlisted("RULE_HEADER_ADOPTION", target)) continue
    const rendersHeader = /<PageHeader[\s>]/.test(uses) || /<h1[\s>]/.test(uses)
    if (!rendersHeader) {
      findings.push({
        rule: "RULE_HEADER_ADOPTION",
        file: route,
        line: 1,
        message: `dashboard route renders no page header${component ? ` (via ${component})` : ""}`,
      })
      continue
    }
    // A hand-rolled <h1> that is not the shared component's is the drift.
    if (!/<PageHeader[\s>]/.test(uses) && /<h1[^>]*text-\[24px\]/.test(uses)) {
      findings.push({
        rule: "RULE_HEADER_ADOPTION",
        file: component ?? route,
        line: 1,
        message: "hand-rolled responsive <h1>; use the shared PageHeader (#261-#264)",
      })
    }
  }

  // RULE_INK_TINT_RATCHET — fails only when the duplication grows.
  const census = {}
  for (const file of files) {
    const r = rel(file)
    if (isOutOfScope(r)) continue
    if (r === DISPLAY_MODULE) continue
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/rgba\(55,53,47,[0-9.]+\)/g)) census[m[0]] ??= new Set()
    for (const m of src.matchAll(/rgba\(55,53,47,[0-9.]+\)/g)) census[m[0]].add(r)
  }
  for (const [literal, baseline] of Object.entries(INK_TINT_BASELINE)) {
    const actual = census[literal]?.size ?? 0
    if (actual > baseline) {
      findings.push({
        rule: "RULE_INK_TINT_RATCHET",
        file: [...(census[literal] ?? [])].sort().join(", "),
        line: 0,
        message: `${literal} now spans ${actual} files (baseline ${baseline}) — extract the constant instead of adding another copy`,
      })
    }
  }

  // RULE_DISPLAY_CONSTANT_RATCHET — a constant the display module owns must not
  // be re-declared in a NEW file. Same shape as the ink-tint ratchet: count
  // DISTINCT FILES, skip the module itself, fail only when the count exceeds
  // the recorded baseline.
  //
  // The module is read as the source of the strings rather than the values
  // being duplicated here. If `textInputClass` changes in components/display.tsx
  // this ratchet follows it automatically; a second hardcoded copy of the class
  // string would drift the moment the design moved, and the drift would be
  // invisible — the rule would go quiet on a tree that had just gained a copy.
  const displaySrc = readFileSync(join(ROOT, DISPLAY_MODULE), "utf8")
  const displayValues = new Map()
  for (const m of displaySrc.matchAll(/export const (\w+)\s*=\s*\n?\s*"([^"]*)"/g)) {
    displayValues.set(m[1], m[2])
  }
  // Every covered constant must still exist in the module. A renamed or
  // deleted export would otherwise silently drop its baseline and the rule
  // would stop watching that geometry — a hole that looks like a clean run.
  const displayCensus = {}
  for (const name of Object.keys(DISPLAY_CONSTANT_RATCHET)) {
    if (displayValues.has(name)) continue
    findings.push({
      rule: "RULE_DISPLAY_CONSTANT_RATCHET",
      file: DISPLAY_MODULE,
      line: 0,
      message: `${name} is ratcheted but ${DISPLAY_MODULE} no longer exports it — restore the constant or drop it from DISPLAY_CONSTANT_RATCHET with a reason`,
    })
  }
  // And every exported string constant must be either ratcheted OR explicitly
  // excluded. A new export falling through both would widen the module's
  // ownership without widening the rule — the silently smaller rule set, which
  // is this ratchet's one real failure mode. Classifying a constant is a
  // judgement call; the checker's job is to stop it happening by omission
  // rather than on purpose.
  for (const name of displayValues.keys()) {
    if (DISPLAY_CONSTANT_RATCHET[name] !== undefined) continue
    if (DISPLAY_CONSTANT_EXCLUDED[name] !== undefined) continue
    findings.push({
      rule: "RULE_DISPLAY_CONSTANT_RATCHET",
      file: DISPLAY_MODULE,
      line: 0,
      message: `${name} is exported but unclassified — give it a baseline in DISPLAY_CONSTANT_RATCHET, or a measured reason in DISPLAY_CONSTANT_EXCLUDED`,
    })
  }
  for (const file of files) {
    const r = rel(file)
    if (isOutOfScope(r)) continue
    // The module holds every one of these strings BY DEFINITION. Counting it
    // would make the rule fire on the source of truth against its own
    // declaration — the exact bug RULE_HEADER_ADOPTION documents for
    // page-header.tsx, which is why it filters that file out of the delegate
    // candidates.
    if (r === DISPLAY_MODULE) continue
    const src = readFileSync(file, "utf8")
    for (const [name, value] of displayValues) {
      if (DISPLAY_CONSTANT_RATCHET[name] === undefined) continue
      if (!src.includes(value)) continue
      displayCensus[name] ??= new Set()
      displayCensus[name].add(r)
    }
  }
  for (const [name, baseline] of Object.entries(DISPLAY_CONSTANT_RATCHET)) {
    const holders = displayCensus[name] ?? new Set()
    if (holders.size > baseline) {
      findings.push({
        rule: "RULE_DISPLAY_CONSTANT_RATCHET",
        file: [...holders].sort().join(", "),
        line: 0,
        message: `${name} is re-declared in ${holders.size} file(s) outside ${DISPLAY_MODULE} (baseline ${baseline}) — import the constant instead of copying its class string (#305/#308)`,
      })
    }
  }

  return {
    findings,
    census: Object.fromEntries(Object.entries(census).map(([k, v]) => [k, v.size])),
    displayCensus: Object.fromEntries(
      Object.keys(DISPLAY_CONSTANT_RATCHET).map((k) => [k, (displayCensus[k] ?? new Set()).size])
    ),
  }
}

// CLI: `node scripts/frontend-drift.mjs`
if (process.argv[1] && process.argv[1].endsWith("frontend-drift.mjs")) {
  const { findings, census, displayCensus } = runChecks()
  if (process.argv.includes("--census")) {
    console.log("ink-tint census:", census)
    console.log("display-constant census:", displayCensus)
  }
  if (findings.length === 0) {
    console.log("frontend drift: clean")
    process.exit(0)
  }
  for (const f of findings) {
    console.log(`${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""}\n  ${f.message}`)
  }
  console.log(`\nfrontend drift: ${findings.length} finding(s)`)
  process.exit(1)
}
