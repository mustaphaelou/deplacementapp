#!/usr/bin/env node
// Mutation harness for the CI gates added in this branch.
//
// Discipline this harness exists to enforce:
//  1. GREEN BASELINE before the first arm and after the last arm. A red
//     baseline is harness contamination, never a finding.
//  2. Snapshot the files BEFORE the first mutation. Never `git checkout --`:
//     with uncommitted work under test, a VCS restore reverts to the pre-fix
//     tree and every later arm measures the wrong thing while reporting
//     confidently.
//  3. restore() must list EVERY file any arm touches. A restore that misses one
//     leaves it mutated, and every later arm then goes red for the leftover
//     reason — which reads exactly like "all my pins bite".
//  4. Assert the FAILURE MODE, not just the exit code. "Tests no tests" with a
//     non-zero exit is a broken harness, and a harness that records that as
//     "the pin bites" is worse than no harness.
//  5. dirty() diff check after every restore.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const FILES = [
  ".github/workflows/docker-publish.yml",
  ".github/workflows/frontend-sweep.yml",
  "Dockerfile",
  "package.json",
]

const snapshot = {}
for (const rel of FILES) snapshot[rel] = readFileSync(join(ROOT, rel), "utf8")

function restore() {
  for (const rel of FILES) writeFileSync(join(ROOT, rel), snapshot[rel])
}

function dirty() {
  const out = execFileSync("git", ["status", "--porcelain", "--", ...FILES], {
    cwd: ROOT,
    encoding: "utf8",
  })
  return out.trim()
}

// Expected git status of the working files once restored: they differ from HEAD
// because this branch is uncommitted work. Compare against the status captured
// right after the baseline instead of expecting empty.
let EXPECTED = null

function mutate(rel, fn) {
  const before = readFileSync(join(ROOT, rel), "utf8")
  const after = fn(before)
  if (after === before) throw new Error(`ARM MUTATION WAS A NO-OP on ${rel}`)
  writeFileSync(join(ROOT, rel), after)
}

function runGate() {
  try {
    execFileSync(
      "npx",
      ["vitest", "run", "scripts/publish-gate.test.ts"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    )
    return { outcome: "GREEN", output: "" }
  } catch (e) {
    return {
      outcome: "RED",
      output: `${e.stdout ?? ""}\n${e.stderr ?? ""}`,
    }
  }
}

function classify(result) {
  const out = result.output
  // The repo's standing tell that the file never loaded, per the audit skill.
  if (/Tests no tests/i.test(out) || /SyntaxError/i.test(out)) {
    return "PARSE-ERROR"
  }
  if (/AssertionError/i.test(out)) return "RED-ASSERTION"
  return "RED-OTHER"
}

const results = []

function arm(name, rel, fn, expectBite) {
  restore()
  mutate(rel, fn)
  const result = runGate()
  const mode = result.outcome === "GREEN" ? "GREEN" : classify(result)
  restore()
  const bite = mode === "RED-ASSERTION"
  const ok = expectBite ? bite : mode === "GREEN"
  results.push({ name, mode, ok })
  console.log(
    `${ok ? "PASS" : "**FAIL**"}  ${name}\n        mode=${mode} expected=${expectBite ? "bites" : "stays green"}`
  )
}

// ---- baseline ----
restore()
const base = runGate()
if (base.outcome !== "GREEN") {
  console.log("BASELINE RED — harness contaminated, aborting.")
  console.log(base.output.slice(0, 4000))
  process.exit(1)
}
EXPECTED = dirty()
console.log("BASELINE GREEN. working-file status:\n  " + (EXPECTED || "(clean)"))
console.log()

// ---- ARM A: re-open the `latest` hole (the defect this branch exists to close) ----
arm(
  "A: restore the default_branch arm on the latest tag",
  ".github/workflows/docker-publish.yml",
  (s) =>
    s.replace(
      "type=raw,value=latest,enable=${{ needs.publish-check.outputs.is_release == 'true' }}",
      "type=raw,value=latest,enable=${{ github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || needs.publish-check.outputs.is_release == 'true' }}"
    ),
  true
)

// ---- ARM B: ungate the image push (branch pushes publish again) ----
arm(
  "B: ungate build-and-push so branch pushes publish",
  ".github/workflows/docker-publish.yml",
  (s) =>
    s.replace(
      "if: github.event_name != 'pull_request' && (needs.publish-check.outputs.is_release == 'true' || (github.event_name == 'workflow_dispatch' && inputs.deploy-dry-run == 'true'))",
      "if: github.event_name != 'pull_request'"
    ),
  true
)

// ---- ARM C: drop the dry-run arm, silently killing the documented dry run ----
arm(
  "C: drop the dry-run arm from build-and-push",
  ".github/workflows/docker-publish.yml",
  (s) =>
    s.replace(
      " || (github.event_name == 'workflow_dispatch' && inputs.deploy-dry-run == 'true'))",
      ")"
    ),
  true
)

// ---- ARM D: gate the smoke test too, so verify coverage needs a Release ----
arm(
  "D: gate publish-check on is_release (no per-merge smoke test)",
  ".github/workflows/docker-publish.yml",
  (s) =>
    s.replace(
      "    if: github.event_name != 'pull_request'\n    needs: verify",
      "    if: needs.publish-check.outputs.is_release == 'true'\n    needs: verify"
    ),
  true
)

// ---- ARM E: remove one timeout ----
arm(
  "E: remove the deploy timeout",
  ".github/workflows/docker-publish.yml",
  (s) => s.replace("    timeout-minutes: 10\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v5\n\n      - name: Deploy to production", "    steps:\n      - name: Checkout\n        uses: actions/checkout@v5\n\n      - name: Deploy to production"),
  true
)

// ---- ARM F: drift CI back to Node 22 ----
arm(
  "F: drift the runner back to node-version 22",
  ".github/workflows/docker-publish.yml",
  (s) => s.replace("node-version: 24", "node-version: 22"),
  true
)

// ---- ARM G: drift the Dockerfile's Node major ----
arm(
  "G: drift the Dockerfile to node:22-alpine",
  "Dockerfile",
  (s) => s.replace("FROM node:24-alpine AS base", "FROM node:22-alpine AS base"),
  true
)

// ---- ARM H: remove engines from package.json ----
arm(
  "H: drop engines from package.json",
  "package.json",
  (s) => s.replace('  "engines": {\n    "node": ">=24 <25"\n  },\n', ""),
  true
)

// ---- ARM I (control): a change no pin claims must stay green ----
arm(
  "I (control): reword a comment the gate does not read",
  ".github/workflows/docker-publish.yml",
  (s) => s.replace("# One run per ref.", "# One run per reference."),
  false
)

// ---- ARM J (control): touch the sweep workflow with no pin on its Node pin ----
arm(
  "J (control): drift ONLY the sweep workflow's Node pin",
  ".github/workflows/frontend-sweep.yml",
  (s) => s.replace("node-version: 24", "node-version: 20"),
  true
)

// ---- final baseline ----
restore()
const final = runGate()
if (final.outcome !== "GREEN") {
  console.log("FINAL BASELINE RED — a restore leaked. Aborting.")
  console.log(final.output.slice(0, 4000))
  process.exit(1)
}
if (dirty() !== EXPECTED) {
  console.log("!! DIRTY after restore:\n" + dirty())
  process.exit(1)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n=== ${results.length - failed.length}/${results.length} arms behaved as expected ===`)
for (const r of failed) console.log(`  FAILED: ${r.name} (mode=${r.mode})`)
process.exit(failed.length === 0 ? 0 : 1)