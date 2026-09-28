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
 * RULE_INK_TINT_RATCHET is a ratchet: it fails only when the known duplication
 * GROWS past the recorded baseline. The existing duplication is real debt
 * (the handoff flags it as a candidate for extraction, deliberately deferred),
 * and blocking the suite on it would be a permanent red that trains everyone
 * to ignore this file. The baseline only ever moves down.
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
 */
const INK_TINT_BASELINE = {
  "rgba(55,53,47,0.024)": 4,
  "rgba(55,53,47,0.06)": 4,
}

/** Radius utilities that resolve to the 3px spec radius in this app. */
const RADIUS_ALLOWED = new Set(["rounded-[3px]", "rounded-lg", "rounded-sm", "rounded-md", "rounded-none", "rounded-full"])
/** Radius utilities that exceed 3px given globals.css's remapped scale. */
const RADIUS_OVER = /rounded-(xl|2xl|3xl|4xl)\b/

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

function isAllowlisted(rule, relPath, line) {
  const entries = ALLOWLIST[rule]
  if (!entries) return false
  if (entries[relPath]) return true
  return Object.entries(entries).some(([pat, _]) => line.includes(pat))
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

export function runChecks() {
  const files = walk(join(ROOT, "app")).concat(walk(join(ROOT, "components")))
  const findings = []

  for (const file of files) {
    const src = readFileSync(file, "utf8")
    const r = rel(file)

    // RULE_TITLE_RESPONSIVE — 40px must only apply from md: up.
    for (const m of src.matchAll(/text-\[40px\]/g)) {
      const line = src.split("\n")[lineOf(src, m.index) - 1] ?? ""
      if (!line.includes("md:text-[40px]") && !isAllowlisted("RULE_TITLE_RESPONSIVE", r, line)) {
        findings.push({
          rule: "RULE_TITLE_RESPONSIVE",
          file: r,
          line: lineOf(src, m.index),
          message: "text-[40px] without an md: twin applies the desktop size at every width (#185/#254)",
        })
      }
    }

    // RULE_RADIUS_SCALE — radius above the 3px spec, in page-level code only.
    if (!isOutOfScope(r)) {
      for (const m of src.matchAll(/rounded-[a-z0-9\[\]-]+/g)) {
        const token = m[0]
        if (RADIUS_OVER.test(token) || RADIUS_ALLOWED.has(token)) continue
        findings.push({
          rule: "RULE_RADIUS_SCALE",
          file: r,
          line: lineOf(src, m.index),
          message: `unrecognised radius utility ${token}; the scale is remapped in globals.css (3px)`,
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
    if (isAllowlisted("RULE_HEADER_ADOPTION", target, "")) continue
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

  return { findings, census: Object.fromEntries(Object.entries(census).map(([k, v]) => [k, v.size])) }
}

// CLI: `node scripts/frontend-drift.mjs`
if (process.argv[1] && process.argv[1].endsWith("frontend-drift.mjs")) {
  const { findings, census } = runChecks()
  if (process.argv.includes("--census")) console.log("ink-tint census:", census)
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
