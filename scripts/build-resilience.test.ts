import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

// WHY THIS FILE EXISTS.
//
// Two defects reached main as red runs, and neither was a code defect:
//
//   1. Main run #195 (2026-09-29, merge of #330) failed `build-and-push
//      runner` with `npm error code ETIMEDOUT` at 164s, inside the Dockerfile
//      deps stage, on the linux/arm64 leg only — the leg that runs under QEMU
//      emulation and is an order of magnitude slower at network I/O than the
//      native one. The next run of the same tree was green. A transient
//      registry hiccup took down a multi-arch build and, with it, the deploy.
//      npm's default retry budget (2 attempts, 10s/60s bounds) is not enough to
//      ride that out, so the flags are pinned here rather than left as a
//      comment nobody re-reads.
//
//   2. Every run emitted `Node.js 20 is deprecated ... actions/checkout@v4,
//      actions/setup-node@v4 ... forced to run on Node.js 24`. The bump to a
//      node24 major is pinned as a DENYLIST rather than as an allowlist of
//      good versions on purpose: an allowlist of "current" versions is a list
//      that is wrong the day a v6 ships, and it fails closed on an upgrade
//      nobody thought about. A denylist of retired runtimes fails only when a
//      step is pinned back to something GitHub has deprecated, which is the
//      edit that actually causes the warning.
//
// Neither pin is a pin on wording. Both survive rewording: the first reads the
// Dockerfile's deps stage and asserts the retry budget is present; the second
// reads every workflow's parsed steps and asserts no step names a retired
// runtime.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DOCKERFILE_PATH = join(ROOT, "Dockerfile")
const WORKFLOWS_DIR = join(ROOT, ".github/workflows")

/**
 * Action majors whose `action.yml` declares `runs.using: node20`, which is the
 * thing GitHub's deprecation warning is actually about. Verified against each
 * action's action.yml at the tag, not inferred from the release notes.
 *
 * When a new major moves an action off Node 20, DELETE its retired entry here
 * rather than adding the new major — the entries are the bad states, not the
 * good ones. A step pinned to any listed major will print the deprecation
 * warning on every run until it is bumped.
 */
const NODE20_RETIRED_ACTIONS: [string, string][] = [
  ["actions/checkout", "v4"],
  ["actions/setup-node", "v4"],
  ["actions/setup-python", "v4"],
  ["actions/upload-artifact", "v4"],
  ["actions/download-artifact", "v4"],
  ["actions/cache", "v4"],
  ["softprops/action-gh-release", "v2"],
]

interface Step {
  name?: string
  uses?: string
  run?: string
}

interface Job {
  steps?: Step[]
}

interface Workflow {
  jobs?: Record<string, Job>
}

function parseWorkflow(raw: string): Workflow {
  return yaml.load(raw) as Workflow
}

function workflowFiles(): string[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => join(WORKFLOWS_DIR, name))
}

function everyWorkflowStep(): { file: string; step: Step }[] {
  const found: { file: string; step: Step }[] = []
  for (const file of workflowFiles()) {
    const workflow = parseWorkflow(readFileSync(file, "utf8"))
    for (const job of Object.values(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (step.uses) found.push({ file, step })
      }
    }
  }
  return found
}

describe("Dockerfile deps stage", () => {
  it("gives npm a retry budget wide enough for the emulated arm64 leg", () => {
    const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8")

    // The deps stage specifically: a retry flag added to some other stage would
    // satisfy a whole-file substring search while leaving the emulated leg
    // exactly as fragile as it was.
    const depsStage = dockerfile.split("AS deps")[1]?.split(/\nFROM /)[0] ?? ""
    expect(depsStage).toContain("npm ci")

    const retries = depsStage.match(/--fetch-retries=(\d+)/)
    expect(retries, "the deps stage must set --fetch-retries").not.toBeNull()
    // npm's default is 2. Asserted as a number so a future editor cannot
    // satisfy the pin by writing `--fetch-retries=0`, which disables retries
    // and reads as though it configures them.
    expect(Number(retries![1])).toBeGreaterThan(2)

    // Both bounds, because retries without a raised ceiling still fail fast:
    // npm gives up on a request that exceeds `fetch-retry-maxtimeout`, and the
    // emulated leg is slow enough to exceed the 60s default.
    expect(depsStage).toMatch(/--fetch-retry-mintimeout=(\d+)/)
    const max = depsStage.match(/--fetch-retry-maxtimeout=(\d+)/)
    expect(max, "the deps stage must set --fetch-retry-maxtimeout").not.toBeNull()
    expect(Number(max![1])).toBeGreaterThan(60_000)
  })

  it("still installs with --ignore-scripts", () => {
    // Unrelated to the retry work, and here because this file is now the one
    // that reads the deps stage: if a rewrite of the retry flags dropped
    // --ignore-scripts, every install script would run inside the image build.
    const depsStage =
      readFileSync(DOCKERFILE_PATH, "utf8").split("AS deps")[1]?.split(/\nFROM /)[0] ??
      ""
    expect(depsStage).toContain("--ignore-scripts")
  })
})

describe("GitHub Actions runtimes", () => {
  it("finds at least one workflow and one pinned step to check", () => {
    // Without this, an empty scan makes every denylist test below vacuously
    // true — the shape of a guard that cannot fail.
    const steps = everyWorkflowStep()
    expect(workflowFiles().length).toBeGreaterThan(0)
    expect(steps.length).toBeGreaterThan(0)
  })

  it("pins no step to an action major that GitHub has retired to Node 20", () => {
    const offenders: string[] = []
    for (const { file, step } of everyWorkflowStep()) {
      for (const [action, major] of NODE20_RETIRED_ACTIONS) {
        if (step.uses?.startsWith(`${action}@${major}`)) {
          offenders.push(`${file}: ${step.uses} (${step.name ?? "unnamed step"})`)
        }
      }
    }
    // Each offender names the file, the pin and the step, because "Node 20 is
    // deprecated" in a run summary does not say which of a dozen steps did it.
    expect(offenders).toEqual([])
  })
})
