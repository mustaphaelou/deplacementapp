import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { MOTIF_LABELS } from "@/lib/demande-presentation"
import {
  MOTIF_CANONICAL_LABEL,
  MOTIF_CANONICAL_SLUG,
  MOTIF_FREE_TEXT,
  STORED_MOTIF_JSON,
} from "@/lib/test/demande-motif-fixtures"

/**
 * #276: `parseMotif` (lib/demande-types.ts) decodes the stored `motif` column.
 * It is a genuine storage reader — it keeps its own malformed-input cases — but
 * it returns SLUGS, and a slug rendered to a DemandeDeplacement's employee, to a
 * printed form or into a PDF is the defect class #274 and #275 shipped.
 *
 * The labelled list lives in one place: `toDemandeDocumentView` in
 * lib/demande-presentation.ts, which maps every entry through MOTIF_LABELS and
 * carries an unmapped « Autre » entry through verbatim.
 *
 * Until now that contract held by CONVENTION — a reviewer's eye, one import at
 * a time — which is why the decoder was reachable from three surfaces before
 * it was migrated. This file makes it MECHANICAL: any module that imports the
 * decoder instead of the projection fails here, naming the file and the line,
 * before the raw slug reaches a screen.
 *
 * The walk mirrors scripts/no-committed-secrets.test.ts — same recursive
 * readdir + SKIP_DIRS shape, same REPO_ROOT from import.meta.url — restricted
 * here to source extensions, because the question is "which module imports this
 * symbol", not "which file contains this string".
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** The projection owner: the ONE production module allowed to read the decoder. */
const PROJECTION = "lib/demande-presentation.ts"

/** The decoder's own suite. A test is not a production reader. */
const DECODER_SUITE = "lib/demande-types.test.ts"

/** This file, resolved from its own path so a rename cannot silently break it. */
const SELF = relative(REPO_ROOT, fileURLToPath(import.meta.url))

/**
 * Widening this set is the only way to add a reader, and it is asserted by
 * name below — so "just this once" is a visible edit, not a silent one. The
 * decoder's malformed-input cases belong in DECODER_SUITE; a second suite
 * probing the decoder is a deliberate addition, not an accident.
 */
const ALLOWED = new Set([PROJECTION, DECODER_SUITE, SELF])

/** Directories that hold no first-party source. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "dist",
  "build",
])

/** The extensions a module can be imported from. */
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full)
    } else if (SOURCE_EXTS.has(full.slice(full.lastIndexOf(".")))) {
      yield full
    }
  }
}

interface Offender {
  /** Repo-relative, as it is typed in a path. */
  file: string
  /** 1-based, in the ORIGINAL file — where an editor jumps. */
  line: number
  statement: string
}

/** `from "…"` — the tail of an import/export-from statement. */
const FROM = /\bfrom\s*(["'])([^"']+)\1/
/** A specifier pointing at the decoder module, however it is spelled. */
const DECODER_SPECIFIER = /(?:^|\/)demande-types(?:\.[cm]?[jt]s)?$/
/** The first line of a top-level import / export statement. */
const STATEMENT_START = /^\s*(?:import|export)\b/
/** The longest an import statement may be before we stop looking for its head. */
const MAX_STATEMENT_LINES = 60

/**
 * The forbidden reaches, all of which route around the projection:
 *   import { parseMotif } from "./demande-types"      — the direct reach
 *   import { parseMotif as decode } from "…"          — laundered through a rename
 *   import * as types from "…"; types.parseMotif(…)   — a namespace reach
 *   export * from "./demande-types"                   — a re-export, i.e. a new reader
 * A type-only import (DemandeWithRelations, Vehicule, …) is NOT one: those
 * carry no value and no reader.
 *
 * Comments are NOT stripped, and deliberately so. A comment that NAMES the
 * forbidden import — `// … the decoder (parseMotif) …`, which the #274
 * regression notes in the two screen suites do — is prose, and this matcher
 * already ignores it: a comment line starts with `//` or `*`, so it can never
 * satisfy STATEMENT_START, and the walk-back below stops at the real import
 * head. Stripping comments instead would shift every line number and mangle
 * string literals, which is how a guard ends up missing the import it exists
 * to catch. The one shape that could still slip past is a block comment whose
 * interior line begins with a bare `import`/`export` — a shape no file here has.
 */
function reachesDecoder(
  statement: string,
  code: string,
  startOffset: number
): number | null {
  const clause = statement.slice(0, statement.search(FROM))
  // Every offset below is resolved against the WHOLE file, so the reported
  // line is the file's line — a line counted inside a sliced statement would be
  // relative to the statement and would point at the wrong place.
  const lineAt = (offset: number) => code.slice(0, offset).split("\n").length
  const at = (index: number) => lineAt(startOffset + Math.max(index, 0))

  const named = /\{([\s\S]*?)\}/.exec(clause)
  if (named && /\bparseMotif\b/.test(named[1])) {
    return at(clause.indexOf(named[0]) + named[0].indexOf("parseMotif"))
  }

  const namespace = /\*\s+as\s+(\w+)/.exec(clause)
  if (namespace) {
    const use = new RegExp(`\\b${namespace[1]}\\.parseMotif\\b`).exec(code)
    if (use) return lineAt(use.index)
  }

  // A wildcard re-export hands the decoder to whoever imports the re-exporter
  // next, so it is a new reader the moment it lands.
  if (/\bexport\s+\*/.test(clause)) return at(clause.indexOf("export"))

  return null
}

/**
 * Every first-party module that reaches the decoder, whether or not it is
 * allowed to. The allowlist is applied by the caller, so this stays a pure
 * function of (path, source) and can be probed with synthetic sources.
 */
function decoderReadersIn(relPath: string, contents: string): Offender[] {
  const lines = contents.split("\n")
  // Character offset of each line's first character, so a position found inside
  // a sliced statement can be resolved back to a line in the original file.
  const lineOffsets: number[] = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }

  const offenders: Offender[] = []

  for (let i = 0; i < lines.length; i++) {
    const from = FROM.exec(lines[i])
    if (!from || !DECODER_SPECIFIER.test(from[2])) continue

    // The `from "…"` is only the tail: walk back to the statement's first line
    // so a multi-line named import is read whole, and its own line number is
    // the one an editor should jump to.
    let start = i
    while (
      start > 0 &&
      i - start < MAX_STATEMENT_LINES &&
      !STATEMENT_START.test(lines[start])
    ) {
      start--
    }
    if (!STATEMENT_START.test(lines[start])) continue

    const statement = lines.slice(start, i + 1).join("\n")
    const line = reachesDecoder(statement, contents, lineOffsets[start])
    if (line !== null) {
      offenders.push({
        file: relPath,
        line,
        statement: statement.replace(/\s+/g, " ").trim().slice(0, 120),
      })
    }
  }

  return offenders
}

function sourceFilesInRepo(): string[] {
  return [...sourceFiles(REPO_ROOT)].map((file) => relative(REPO_ROOT, file))
}

function decoderReadersInRepo(): Offender[] {
  const offenders: Offender[] = []
  for (const file of sourceFiles(REPO_ROOT)) {
    const rel = relative(REPO_ROOT, file)
    for (const offender of decoderReadersIn(rel, readFileSync(file, "utf8"))) {
      if (!ALLOWED.has(offender.file)) offenders.push(offender)
    }
  }
  return offenders
}

const GUIDANCE =
  "The stored Motif is a SLUG; a slug on a screen, a printed form or a PDF is " +
  "the defect #274/#275 shipped. lib/demande-presentation.ts owns the labelled " +
  "list — call toDemandeDocumentView({ motif, typeTransport, etape, decision }) " +
  "and render `view.motifs`, never parseMotif's return value. The decoder's own " +
  "malformed-input cases stay in lib/demande-types.test.ts."

describe("the Motif storage decoder has one production reader", () => {
  it("is imported by the projection and by nothing else in the repo", () => {
    const offenders = decoderReadersInRepo()

    expect(
      offenders,
      `These modules import the Motif storage decoder (parseMotif) instead of ` +
        `going through the document projection:\n` +
        offenders.map((o) => `  ${o.file}:${o.line} — ${o.statement}`).join("\n") +
        `\n\n${GUIDANCE}`
    ).toEqual([])
  })

  it("keeps the projection as the module that actually reads the decoder", () => {
    // A guard that passes because its subject stopped existing is a guard that
    // has stopped guarding: were the projection migrated off parseMotif, the
    // scan above would find zero readers and call the tree clean.
    const projection = readFileSync(join(REPO_ROOT, PROJECTION), "utf8")

    expect(decoderReadersIn(PROJECTION, projection).length).toBeGreaterThan(0)
    expect(projection).toContain("export function toDemandeDocumentView")
  })

  it("names the allowlist, so a new reader is a visible edit", () => {
    expect([...ALLOWED].sort()).toEqual([DECODER_SUITE, PROJECTION, SELF].sort())
    // The decoder's own suite must keep exercising it, or the malformed-input
    // cases have quietly stopped running.
    expect(
      decoderReadersIn(
        DECODER_SUITE,
        readFileSync(join(REPO_ROOT, DECODER_SUITE), "utf8")
      )
    ).toHaveLength(1)
  })

  it("walks the source tree rather than a hardcoded file list", () => {
    // A list of a handful of known files would report "clean" forever, and
    // would not notice a NEW surface reaching for the decoder — the exact
    // regression this guard exists to prevent. Pin the walk reaching every
    // source root, so falling back to a list is a red suite.
    const files = sourceFilesInRepo()

    for (const root of ["app", "components", "hooks", "lib", "scripts"]) {
      expect(
        files.filter((file) => file.startsWith(`${root}/`)).length,
        `the walk never reached ${root}/`
      ).toBeGreaterThan(0)
    }
    expect(files.length).toBeGreaterThan(100)
  })

  it("detects the reaches it claims to, and leaves the legal ones alone", () => {
    // The scan above only ever prints "clean" on this tree, which is exactly
    // what a broken matcher prints. Probed against synthetic sources so the
    // detector proves itself without a defect in the repo.
    const reaches = (source: string) =>
      decoderReadersIn("lib/synthetic-probe.ts", source).map((o) => o.line)

    // The direct reach, and the same thing laundered through a rename. The
    // line reported is where the offending identifier sits, not where the
    // statement starts.
    expect(
      reaches(`import { PIPELINE } from "./workflow"\nimport { parseMotif } from "./demande-types"`)
    ).toEqual([2])
    expect(
      reaches(`import {\n  parseMotif as decode,\n} from "@/lib/demande-types"`)
    ).toEqual([2])
    // A namespace reach, used below the import — reported where it is used.
    expect(
      reaches(
        `import * as types from "../demande-types"\n\nexport const m = types.parseMotif(raw)`
      )
    ).toEqual([3])
    // A re-export is a new reader, whoever imports it next.
    expect(reaches(`export * from "./demande-types"`)).toEqual([1])
    // And from another directory entirely, where the specifier is not "./".
    expect(reaches(`import { parseMotif } from "@/lib/demande-types"`)).toEqual([1])

    // Inverses: the shapes that must stay silent. A type-only import carries
    // no value; a comment that names the decoder is prose; a same-named symbol
    // from another module is unrelated.
    expect(reaches(`import type { DemandeWithRelations } from "./demande-types"`)).toEqual([])
    expect(reaches(`// the page read the decoder (parseMotif) before #274`)).toEqual([])
    expect(
      reaches(`/**\n * Reads the decoder (parseMotif) straight from storage.\n */\nexport const x = 1`)
    ).toEqual([])
    expect(reaches(`import { parseMotif } from "./demande-formatter"`)).toEqual([])
    // A module that mentions the decoder's HOME module without binding the
    // decoder is a type reader, not a value reader.
    expect(reaches(`export type { Actor } from "../demande-types"`)).toEqual([])
  })
})

/** The three surfaces the projection feeds, named as their suites assert it. */
const SURFACE_SUITES = [
  "app/(dashboard)/demandes/[id]/page.test.tsx",
  "app/(dashboard)/demandes/[id]/imprimer/page.test.tsx",
  "lib/pdf-mapper.test.ts",
]

const FIXTURE_MODULE = "lib/test/demande-motif-fixtures.ts"
const FIXTURE_SPECIFIER = /from\s*["'][^"']*demande-motif-fixtures["']/

describe("one shared Motif fixture set drives the three surfaces", () => {
  it("is imported by the detail page, the printable form and the PDF render data", () => {
    const missing = SURFACE_SUITES.filter(
      (suite) => !FIXTURE_SPECIFIER.test(readFileSync(join(REPO_ROOT, suite), "utf8"))
    )

    expect(
      missing,
      `These surface suites do not import the shared Motif fixtures ` +
        `(${FIXTURE_MODULE}):\n  ${missing.join("\n  ")}\nThey must seed from ` +
        `the one production-shaped fixture set, or a surface that stops going ` +
        `through the projection passes on a seed that reads the same either way.`
    ).toEqual([])
  })

  it("is the seed each of the three renders from, not a parallel one", () => {
    // Importing the module is not enough: a suite can import it and still build
    // its own motif literal. The shared SET is what has to be shared.
    const notSeeded = SURFACE_SUITES.filter(
      (suite) => !readFileSync(join(REPO_ROOT, suite), "utf8").includes("STORED_MOTIF_JSON")
    )

    expect(
      notSeeded,
      `Surface suites that do not seed from the shared STORED_MOTIF_JSON:\n  ${notSeeded.join("\n  ")}`
    ).toEqual([])
  })

  it("stays production-shaped: a canonical slug plus an « Autre » free-text entry", () => {
    // A suite seeded with a stored literal that reads identically labelled or
    // raw cannot see a surface that forgot to label its Motifs. The fixture is
    // only worth sharing if it stays in slug space.
    expect(MOTIF_LABELS[MOTIF_CANONICAL_SLUG]).toBe(MOTIF_CANONICAL_LABEL)
    // The free-text entry is the case the projection's fallback rule exists
    // for: it is in no MOTIF_LABELS key, so it must survive verbatim.
    expect(Object.keys(MOTIF_LABELS)).not.toContain(MOTIF_FREE_TEXT)
    expect(STORED_MOTIF_JSON).toContain(MOTIF_CANONICAL_SLUG)
    expect(STORED_MOTIF_JSON).toContain(MOTIF_FREE_TEXT)
  })
})
