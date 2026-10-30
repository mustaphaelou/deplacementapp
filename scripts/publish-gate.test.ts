import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

// GATE-NOTES — what this gate holds, and what it deliberately does not.
// Three notes, kept together because each records a decision a future editor
// would otherwise have to reverse-engineer: (1) the scope, (2) the coverage
// this gate gave up in #323 and why, (3) what the surviving pins were measured
// to hold in #324. Grep for "GATE-NOTES" to find them again.

// NOTE 1 — SCOPE.
//
// This gate asserts claims about the release job: the publish chain, the two
// jobs and their order, the exact deploy condition, malformed tags failing the
// run and pushing nothing, the deploy as the last act. It does not assert how a
// document is worded. Rephrasing a sentence in any document the gate reads must
// leave it green.

// NOTE 2 — THE COVERAGE THIS GATE GAVE UP (#323).
//
// Twelve tests here once opened a prose document — the ticket that prompted
// this change counted seven, which was low. They split cleanly in two:
//
//   - A `toContain` about a chosen phrase says "this sentence must always be
//     worded this way". That is not a property of the release. Those are
//     dropped.
//   - A `not.toContain` fails only if something APPEARS, so it says "this
//     claim must never be made". That is a claim about correctness, and it
//     survives rewrites. Those are kept, each commented at its assertion.
//
// Dropping the phrase tests is a TRADE OF COUPLING FOR COVERAGE, accepted on
// purpose, and the coverage given up is named here so a reader who disagrees
// has the argument rather than having to reconstruct it: the gate no longer
// requires the release process overview to describe the deploy hop, and it no
// longer requires ADR-0015 to record the publish gate as the trust precondition
// for auto-deploy. Both were phrase assertions; neither was a property of the
// release job. The durable form of what they half-measured — that the
// documentation is required to describe the deploy at all — belongs to whoever
// owns the documentation, not to the release gate.
//
// The other four DROPPED tests, named so the record is the real set:
//   - `defines the publish gate term in the deployment documentation`
//     (CONTEXT.md must name the publish gate and its three jobs)
//   - `records the twin-block deepening candidate as closed in ADR-0004`
//   - `records the who-pulls decision in ADR-0015 and cites ADR-0004`
//   - `documents the deploy exactly as the workflow ships it`
// The last is the one worth a second reading, because it also held two claims
// about the workflow rather than about prose. Those were not lost: they are
// subsumed by the exact `toBe` on `job("deploy").if` in `deploys only on the
// exact single-owner gate` (see NOTE 3). Same reasoning as the three above it.
//
// Narrowing a test drops assertions too, and those are the larger half of what
// went: six surviving tests each kept only their `not.toContain` guards, and
// with them went the phrase assertions those tests used to carry — CONTEXT.md
// naming `publish-check` and `build-and-push`, ADR-0003's "no consumer pulls an
// arm64 migrator" and the arm64-drop consequence, ADR-0004's "non-semver tags
// fail", release.md naming `release-gate`, "Coolify deploy webhook" and
// "escape hatch", CONTEXT.md's Release entry naming the webhook and ADR-0015,
// and the naming half of "secrets by name only". None of those has a new home
// and none should: each says a sentence must be worded a particular way. They
// are listed here so a reader reconstructing the trade is not left to infer it.

// NOTE 3 — WHAT THE SURVIVING PINS WERE MEASURED TO HOLD (#324).
//
// #324 broke the workflow on purpose and reverted it. Three results belong to
// the next reader, because each is an edit a careful person could make that
// leaves every test here green:
//
//   - The chain is pinned as a GRAPH, not as a file layout. Moving
//     `build-and-push` above `publish-check` with every `needs:` left intact
//     keeps the file green. Exactly one test reads key order — `keeps deploy
//     as the final job of the workflow` — so moving `deploy` up fails that one
//     and nothing else changes. Both facts are correct: `needs:` is what
//     GitHub Actions executes, and deploy-last is the one ordering that carries
//     a meaning ("the last act"), which is why it is the one pinned as text.
//   - The push trigger is pinned by `toContain("v*")` in two places, which
//     says `v*` must be AMONG the patterns, not that it is the only one.
//     `tags: ["v*", "*"]` is green; `tags: ["*"]` is red on both tests. What
//     the gate does not see is covered at runtime instead: the release-gate
//     step exits 1 on a non-semver tag, so an over-broad trigger turns a
//     stray tag into a failed run rather than into a deploy.
//   - The release file is pinned against the PARSED step, not the bytes, and
//     that is deliberate. #324 weighed adding a raw-text
//     `toContain("scripts/deploy-coolify.sh")` on the workflow text and
//     rejected it on the evidence of a probe: renaming both invocations to
//     `scripts/coolify-deploy.sh` while leaving a YAML comment naming the old
//     file keeps `raw.includes("scripts/deploy-coolify.sh")` TRUE — a comment
//     supplies the string — while the existing parsed pin goes RED on all three
//     tests that call `deployScriptStep()`. The proposed assertion would have
//     passed the defect it was written to catch; the existing one catches it.
//     The pin in question lives in `switches between dry-run and the real
//     webhook from the dispatch input`, which reads the parsed `run` and
//     asserts the whole invocation — script, flags and ref — on both branches.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const WORKFLOW_PATH = join(ROOT, ".github/workflows/docker-publish.yml")
const WRAPPER_PATH = join(ROOT, "scripts/test-docker-build.sh")
const CONTEXT_PATH = join(ROOT, "CONTEXT.md")
const RELEASE_DOCS_PATH = join(ROOT, "docs/agents/release.md")
const ADR_0003_PATH = join(
  ROOT,
  "docs/adr/0003-separate-migrations-from-runtime-image.md"
)
const ADR_0004_PATH = join(ROOT, "docs/adr/0004-ghcr-as-container-registry.md")
const ADR_0015_PATH = join(
  ROOT,
  "docs/adr/0015-deployment-triggered-on-release-tags.md"
)

interface Step {
  name?: string
  id?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
}

interface Job {
  if?: string
  needs?: string | string[]
  outputs?: Record<string, unknown>
  steps?: Step[]
  // GitHub Actions accepts either spelling, but a YAML key is a literal string:
  // `timeout-minutes` does NOT become `timeout_minutes` when parsed. Reading
  // the underscored form returns undefined on a file that is fully compliant,
  // which is how a gate teaches you to distrust itself.
  "timeout-minutes"?: number
  timeout_minutes?: number
  strategy?: {
    matrix?: {
      include?: Record<string, string>[]
    }
  }
}

interface Workflow {
  on?: {
    pull_request?: unknown
    push?: {
      branches?: string[]
      tags?: string[]
    }
    workflow_dispatch?: {
      inputs?: Record<
        string,
        { description?: string; type?: string; default?: boolean }
      >
    }
  }
  jobs?: Record<string, Job>
}

function loadWorkflow(): Workflow {
  const raw = readFileSync(WORKFLOW_PATH, "utf8")
  return yaml.load(raw) as Workflow
}

function verifySteps(): Step[] {
  return loadWorkflow().jobs?.["verify"]?.steps ?? []
}

function publishCheckSteps(): Step[] {
  return loadWorkflow().jobs?.["publish-check"]?.steps ?? []
}

function buildAndPushSteps(): Step[] {
  return loadWorkflow().jobs?.["build-and-push"]?.steps ?? []
}

function deploySteps(): Step[] {
  return loadWorkflow().jobs?.["deploy"]?.steps ?? []
}

function matrixRows(): Record<string, string>[] {
  return (
    loadWorkflow().jobs?.["build-and-push"]?.strategy?.matrix?.include ?? []
  )
}

function matrixRowsById(): Map<string, Record<string, string>> {
  return new Map(matrixRows().map((row) => [row.id, row]))
}

function job(name: string): Job {
  return loadWorkflow().jobs?.[name] ?? {}
}

function deployScriptStep(): Step {
  const step = deploySteps().find((s) =>
    (s.run ?? "").includes("deploy-coolify.sh")
  )
  if (!step) throw new Error("deploy-coolify.sh step not found")
  return step
}

function runScripts(steps: Step[]): string {
  return steps.map((step) => step.run ?? "").join("\n")
}

function wrapperContents(): string {
  return readFileSync(WRAPPER_PATH, "utf8")
}

function releaseGateStep(): Step {
  const gate = publishCheckSteps().find((step) => step.id === "release-gate")
  if (!gate) throw new Error("release-gate step not found")
  return gate
}

function metadataSteps(): Step[] {
  return buildAndPushSteps().filter((step) =>
    step.uses?.includes("docker/metadata-action")
  )
}

function isDockerBuildStep(step: Step): boolean {
  return step.uses?.includes("docker/build-push-action") ?? false
}

function isSmokeBuildStep(step: Step): boolean {
  return isDockerBuildStep(step) && step.with?.load === true
}

function isPushStep(step: Step): boolean {
  return isDockerBuildStep(step) && step.with?.push === true
}

function dockerBuildStepIndices(
  steps: Step[],
  predicate: (step: Step) => boolean
): number[] {
  const indices: number[] = []
  for (const [index, step] of steps.entries()) {
    if (predicate(step)) indices.push(index)
  }
  return indices
}

const PUBLISH_CHAIN = [
  "verify",
  "publish-check",
  "build-and-push",
  "release",
  "deploy",
]

describe(".github/workflows/docker-publish.yml", () => {
  it("parses as YAML", () => {
    expect(() => loadWorkflow()).not.toThrow()
  })

  it("defines the publish gate chain: verify → publish-check → build-and-push (matrix) → release → deploy", () => {
    for (const name of PUBLISH_CHAIN) {
      expect(loadWorkflow().jobs?.[name]).toBeDefined()
    }
    expect(job("publish-check").needs).toContain("verify")
    expect(job("build-and-push").needs).toContain("publish-check")
    expect(job("release").needs).toContain("build-and-push")
    expect(job("deploy").needs).toContain("build-and-push")
  })

  it("runs the unit gate on every trigger, including pull requests", () => {
    const on = loadWorkflow().on
    expect(on?.pull_request).toBeDefined()
    expect(on?.workflow_dispatch).toBeDefined()
    expect(on?.push?.branches).toContain("main")
    expect(on?.push?.tags).toContain("v*")
  })

  it("keeps pull requests to unit checks only (no Docker work, publish jobs skipped)", () => {
    const dockerBuilds = verifySteps().filter(isDockerBuildStep)
    expect(dockerBuilds).toHaveLength(0)
    for (const name of ["publish-check", "build-and-push"]) {
      expect(job(name).if).toContain("github.event_name")
      expect(job(name).if).toContain("pull_request")
    }
  })

  it("runs lint, typecheck, the unit tests, and the production dependency-tree check in verify", () => {
    const runs = runScripts(verifySteps())
    expect(runs).toContain("npm run lint")
    expect(runs).toContain("npm run typecheck")
    expect(runs).toContain("npm run test")
    expect(runs).toContain("npm ls --omit=dev")
  })

  it("keeps the production dependency-tree check out of the local wrapper", () => {
    const wrapper = wrapperContents()
    expect(wrapper).not.toContain("npm ls --omit=dev --depth=0")
  })

  it("never names the retired publish job or the retired job ordering in the CONTEXT.md Deployment section", () => {
    const docs = readFileSync(CONTEXT_PATH, "utf8")
    const deployment = docs.split("### Deployment")[1] ?? ""
    // Guards of a claim that must never be made, not pins on wording: both
    // strings name a job or an ordering the publish chain was renamed away
    // from. A reader following either would wire the wrong job graph. They
    // fail only if the retired name reappears, so any rewording is free.
    expect(deployment).not.toContain("build-and-publish")
    expect(deployment).not.toContain("after the publish job")
  })

  describe("publish-check (gate owner + smoke)", () => {
    it("smoke-tests both loaded images before the matrix can push", () => {
      const steps = publishCheckSteps()
      const smokeBuildIndices = dockerBuildStepIndices(steps, isSmokeBuildStep)
      expect(smokeBuildIndices).toHaveLength(2)
      for (const index of smokeBuildIndices) {
        expect(steps[index].with?.platforms).toBe("linux/amd64")
        expect(steps[index].with?.push).toBeUndefined()
      }
      const lastSmokeBuildIndex = Math.max(...smokeBuildIndices)

      const smokeTestIndex = steps.findIndex((step) =>
        (step.run ?? "").includes("smoke-test.sh")
      )
      expect(smokeTestIndex).toBeGreaterThan(-1)
      expect(smokeTestIndex).toBeGreaterThan(lastSmokeBuildIndex)
      const smokeTestRun = steps[smokeTestIndex].run ?? ""
      expect(smokeTestRun).toContain("--image")
      expect(smokeTestRun).toContain("--migrator-image")

      // publish-check never pushes; the push job cannot start until it is green
      expect(steps.filter(isPushStep)).toHaveLength(0)
      expect(job("build-and-push").needs).toContain("publish-check")
    })

    it("writes the smoke builds to the GHA cache so verification feeds the publish build", () => {
      const smokeBuildSteps = publishCheckSteps().filter(isSmokeBuildStep)
      expect(smokeBuildSteps).toHaveLength(2)
      for (const step of smokeBuildSteps) {
        expect(step.with?.["cache-from"]).toContain("type=gha")
        expect(step.with?.["cache-to"]).toContain("type=gha")
      }
    })

    it("keeps the smoke image names as a documented one-place duplication of the map", () => {
      const runs = runScripts(publishCheckSteps())
      expect(runs).toContain(
        'scripts/smoke-test.sh --image "ghcr.io/${{ github.repository }}/runner:smoke"'
      )
      expect(runs).toContain(
        '"ghcr.io/${{ github.repository }}-migrator:smoke"'
      )
    })

    it("wires the local wrapper and the workflow to the same smoke-test module", () => {
      const wrapper = wrapperContents()
      const workflowRuns = runScripts(publishCheckSteps())
      expect(wrapper).toContain("smoke-test.sh")
      expect(workflowRuns).toContain("smoke-test.sh")
      expect(wrapper).toContain("--image")
      expect(wrapper).toContain("--migrator-image")
      expect(workflowRuns).toContain("--migrator-image")
    })
  })

  describe("build-and-push (image-map matrix)", () => {
    it("drives the build from one matrix include row per image", () => {
      const byId = matrixRowsById()
      expect(byId.size).toBe(2)

      const runner = byId.get("runner")
      const migrator = byId.get("migrator")
      expect(runner).toBeDefined()
      expect(migrator).toBeDefined()
      expect(runner?.target).toBe("runner")
      expect(migrator?.target).toBe("migrator")
      expect(runner?.image).toBe("ghcr.io/${{ github.repository }}/runner")
      expect(migrator?.image).toBe("ghcr.io/${{ github.repository }}-migrator")
    })

    it("keeps the runner multi-arch but narrows the migrator to amd64 only", () => {
      const byId = matrixRowsById()
      expect(byId.size).toBe(2)

      const runner = byId.get("runner")
      expect(runner?.platforms).toBe("linux/amd64,linux/arm64")

      const migrator = byId.get("migrator")
      expect(migrator?.platforms).toBe("linux/amd64")
    })

    it("forbids ADR-0003 from listing the migrator's platforms in the reversed order", () => {
      const adr = readFileSync(ADR_0003_PATH, "utf8")
      // Guard of a claim that must never be made, not a pin on wording: the
      // reversed list would state that the arm64 build is the primary and
      // amd64 the variant, which is the opposite of what the matrix ships. It
      // fails only if the wrong order appears, so rewording is free.
      expect(adr).not.toContain("linux/arm64,linux/amd64")
    })

    it("fans the build and push out of one matrix template using the row's own fields", () => {
      const pushSteps = buildAndPushSteps().filter(isPushStep)
      expect(pushSteps).toHaveLength(1)
      const step = pushSteps[0]
      expect(step.with?.context).toBe(".")
      expect(step.with?.target).toBe("${{ matrix.target }}")
      expect(step.with?.platforms).toBe("${{ matrix.platforms }}")
      expect(step.with?.push).toBe(true)
      expect(step.with?.tags).toBe("${{ steps.meta.outputs.tags }}")
      expect(step.with?.labels).toBe("${{ steps.meta.outputs.labels }}")
      expect(step.with?.["cache-from"]).toContain("type=gha")
      expect(step.with?.["cache-to"]).toContain("type=gha")

      const metas = metadataSteps()
      expect(metas).toHaveLength(1)
      expect(metas[0].with?.images).toBe("${{ matrix.image }}")
    })

    it("keeps the tag policy identical across rows and gated on is_release", () => {
      const metas = metadataSteps()
      expect(metas).toHaveLength(1)
      const tags = String(metas[0].with?.tags ?? "")
      expect(tags).toContain("type=semver,pattern=v{{version}}")
      expect(tags).toContain("type=semver,pattern={{major}}.{{minor}}")
      expect(tags).toContain("type=sha,format=long")
      expect(tags).toContain("value=latest")
      expect(tags).toContain("needs.publish-check.outputs.is_release")

      // `latest` must move ONLY on a Release. This arm used to be a union with
      // `github.ref == refs/heads/<default_branch>`, which meant every merge to
      // main republished a public rolling alias of unreviewed code — the exact
      // hole ADR-0015 closed by moving release-ness behind a gate. With
      // build-and-push now gated on is_release, that arm was dead weight, and
      // leaving it in place would silently re-open the hole the day the gate
      // was ever loosened. Asserted as an ABSENCE so the union cannot be
      // restored by appending it back: a `toContain("default_branch")` pin
      // would pass on the very string that causes the defect.
      expect(tags).not.toContain("github.event.repository.default_branch")
      expect(tags).not.toContain("refs/heads/")
    })

    it("gates the only image-pushing job on is_release, with the dry-run dispatch as its sole other arm", () => {
      const push = job("build-and-push").if ?? ""
      // Branch pushes must never reach this job. `is_release` is the single
      // owner of release-ness (release-gate), so the gate is that output and
      // not a second spelling of "is this a release".
      expect(push).toContain("needs.publish-check.outputs.is_release == 'true'")
      // The dry-run arm is load-bearing, not decorative: `deploy` needs
      // build-and-push, so without this arm a dry-run dispatch finds a skipped
      // dependency and the documented dry run silently never runs.
      expect(push).toContain("inputs.deploy-dry-run == 'true'")
      expect(push).toContain("github.event_name")
      // Both arms are required — either one alone is a different workflow.
      expect(push).toContain("||")
      expect(push).toContain("!=")
    })

    it("still smoke-tests on a branch push, so verify coverage does not depend on a Release", () => {
      // The image PUSH is release-gated; the smoke test deliberately is not.
      // If both were gated, a Dockerfile or compose regression would sit on
      // main until the next Release — and the first tag cut would be the run
      // that discovered it. publish-check must keep running on branch pushes.
      const check = job("publish-check").if ?? ""
      expect(check).toContain("github.event_name != 'pull_request'")
      expect(check).not.toContain("is_release")
      expect(job("build-and-push").needs).toContain("publish-check")
    })

    it("caps every job with a timeout so a wedged runner cannot hold its concurrency group for 6h", () => {
      const jobs = loadWorkflow().jobs ?? {}
      for (const name of ["verify", "publish-check", "build-and-push", "release", "deploy"]) {
        const minutes = jobs[name]?.["timeout-minutes"]
        expect(minutes, `${name} has no timeout-minutes`).toBeTypeOf("number")
        expect(minutes as number).toBeGreaterThan(0)
        expect(minutes as number).toBeLessThanOrEqual(60)
      }
    })

    it("runs CI on the Node version the production image runs", () => {
      // Dockerfile pins node:24-alpine. A CI runner on a different major tests
      // a runtime production never executes, so a failure rate that says
      // "green" can mean "never ran here". Both workflows, or the drift returns.
      const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf8")
      const image = /^FROM node:(\d+)/m.exec(dockerfile)?.[1]
      expect(image, "could not read the Node major out of the Dockerfile").toBeTruthy()
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
      expect(pkg.engines?.node).toContain(image as string)
      for (const path of [
        WORKFLOW_PATH,
        join(ROOT, ".github/workflows/frontend-sweep.yml"),
      ]) {
        const workflow = readFileSync(path, "utf8")
        expect(
          workflow,
          `${path} pins a Node major other than ${image}`
        ).not.toMatch(/node-version:\s*(?!24)\d+/)
      }
    })

    it("keeps a matrix job output out of gating (last-to-finish semantics)", () => {
      expect(job("build-and-push").outputs).toBeUndefined()
      const jobs = loadWorkflow().jobs ?? {}
      for (const [, candidate] of Object.entries(jobs)) {
        if (candidate.if) {
          expect(candidate.if).not.toContain("needs.build-and-push.outputs")
        }
      }
    })
  })

  describe("release gate", () => {
    it("runs the release gate right after checkout, before any Docker setup", () => {
      const steps = publishCheckSteps()
      const gateIndex = steps.findIndex((step) => step.id === "release-gate")
      const checkoutIndex = steps.findIndex((step) =>
        step.uses?.includes("actions/checkout")
      )
      const qemuIndex = steps.findIndex((step) =>
        step.uses?.includes("docker/setup-qemu-action")
      )
      expect(gateIndex).toBeGreaterThan(-1)
      expect(checkoutIndex).toBeGreaterThan(-1)
      expect(qemuIndex).toBeGreaterThan(-1)
      expect(gateIndex).toBeGreaterThan(checkoutIndex)
      expect(gateIndex).toBeLessThan(qemuIndex)
    })

    it("computes release-ness once, from a strict semver regex on tag refs", () => {
      const computing = publishCheckSteps().filter((step) =>
        (step.run ?? "").includes("is_release=")
      )
      expect(computing).toHaveLength(1)
      const gate = computing[0]
      expect(gate.id).toBe("release-gate")
      const run = gate.run ?? ""
      expect(run).toContain("GITHUB_REF_TYPE")
      expect(run).toContain("^v[0-9]+\\.[0-9]+\\.[0-9]+$")
      expect(run).toContain("is_release=true")
      expect(run).toContain("is_release=false")
    })

    it("fails fast on a malformed v* tag with a clear error, before Docker work", () => {
      const run = releaseGateStep().run ?? ""
      expect(run).toContain("::error::")
      expect(run).toContain("exit 1")
      expect(run).toContain("GITHUB_REF_NAME")
    })

    it("flows the gate's single output to the metadata enable and both downstream gate jobs", () => {
      const workflow = readFileSync(WORKFLOW_PATH, "utf8")
      expect(workflow).not.toContain("release-check")
      expect(job("publish-check").outputs?.is_release).toContain(
        "steps.release-gate.outputs.is_release"
      )
      for (const step of metadataSteps()) {
        expect(String(step.with?.tags ?? "")).toContain(
          "needs.publish-check.outputs.is_release"
        )
      }
      expect(job("release").if).toContain(
        "needs.publish-check.outputs.is_release"
      )
      expect(job("deploy").if).toContain(
        "needs.publish-check.outputs.is_release"
      )
    })

    it("keeps the coarse v* trigger so the gate is the single owner of release-ness", () => {
      expect(loadWorkflow().on?.push?.tags).toContain("v*")
    })

    it("never lets the deploy docs call a malformed tag harmless or name a retired release-check step", () => {
      const releaseDocs = readFileSync(RELEASE_DOCS_PATH, "utf8")
      const adr = readFileSync(ADR_0004_PATH, "utf8")
      // Guards of a claim that must never be made, not pins on wording:
      // calling a malformed tag "harmless" tells a releaser the run can be
      // ignored when it in fact fails the gate, and "release-check" is the
      // step id the gate was renamed away from, so its reappearance means the
      // documentation describes a workflow that no longer exists. Each fails
      // only if the wrong thing appears, so rewording the docs is free.
      expect(releaseDocs).not.toContain("harmless")
      expect(releaseDocs).not.toContain("release-check")
      expect(adr).not.toContain("release-check")
    })
  })

  describe("draft Release job", () => {
    it("creates the draft Release in its own job after the matrix push, gated on is_release only", () => {
      const release = job("release")
      expect(release.needs).toContain("build-and-push")
      expect(release.needs).toContain("publish-check")
      expect(release.if).toBe(
        "needs.publish-check.outputs.is_release == 'true'"
      )
      const steps = release.steps ?? []
      const draft = steps.find((step) =>
        step.uses?.includes("softprops/action-gh-release")
      )
      expect(draft).toBeDefined()
      expect(draft?.with?.draft).toBe(true)
      expect(draft?.with?.tag_name).toContain("github.ref_name")
      expect(draft?.with?.name).toContain("github.ref_name")
    })
  })

  describe("deploy job", () => {
    it("depends on build-and-push, so verify is transitively covered", () => {
      expect(job("deploy").needs).toContain("build-and-push")
    })

    it("promotes the release-gate output to a publish-check job output", () => {
      expect(job("publish-check").outputs?.is_release).toContain(
        "steps.release-gate.outputs.is_release"
      )
    })

    it("deploys only on the exact single-owner gate: Release output, or an explicit dry-run dispatch", () => {
      expect(job("deploy").if).toBe(
        "needs.publish-check.outputs.is_release == 'true' || (github.event_name == 'workflow_dispatch' && inputs.deploy-dry-run == 'true')"
      )
    })

    it("adds a workflow_dispatch dry-run input so the seam is testable without firing", () => {
      const inputs = loadWorkflow().on?.workflow_dispatch?.inputs
      expect(inputs?.["deploy-dry-run"]).toBeDefined()
      expect(inputs?.["deploy-dry-run"]?.type).toBe("boolean")
      expect(deployScriptStep().run).toContain("--dry-run")
      expect(runScripts(deploySteps())).toContain("deploy-coolify.sh")
    })

    it("maps the Coolify secrets into the deploy step by name only, never embedding values", () => {
      const step = deployScriptStep()
      expect(step.env?.COOLIFY_WEBHOOK).toBe("${{ secrets.COOLIFY_WEBHOOK }}")
      expect(step.env?.COOLIFY_TOKEN).toBe("${{ secrets.COOLIFY_TOKEN }}")
      expect(runScripts(deploySteps())).not.toContain("COOLIFY_WEBHOOK:")
      const raw = readFileSync(WORKFLOW_PATH, "utf8")
      expect(raw).toContain("secrets.COOLIFY_WEBHOOK")
      expect(raw).toContain("secrets.COOLIFY_TOKEN")
    })

    it("switches between dry-run and the real webhook from the dispatch input, passing the ref on both paths", () => {
      const step = deployScriptStep()
      const run = step.run ?? ""
      // These two lines are the pin on the release file. #324 asked whether
      // the file should ALSO be pinned against the raw workflow text and
      // concluded no — see GATE-NOTES: "the release file is pinned against
      // the parsed step, not the bytes" for that argument and the probe that
      // decided it.
      expect(run).toContain(
        'scripts/deploy-coolify.sh --dry-run --ref "$GITHUB_REF_NAME"'
      )
      expect(run).toContain(
        'scripts/deploy-coolify.sh --ref "$GITHUB_REF_NAME"'
      )
      expect(run).toContain("DEPLOY_DRY_RUN")
      expect(step.env?.DEPLOY_DRY_RUN).toContain("inputs.deploy-dry-run")
    })

    it("keeps the deploy job a leaf: nothing depends on it, so a webhook failure re-runs no other job", () => {
      const jobs = loadWorkflow().jobs ?? {}
      const others = Object.entries(jobs).filter(([name]) => name !== "deploy")
      expect(others.length).toBeGreaterThan(0)
      for (const [, job] of others) {
        if (job.needs) expect(job.needs).not.toContain("deploy")
      }
    })

    it("keeps deploy as the final job of the workflow (deploy is the last act)", () => {
      const jobNames = Object.keys(loadWorkflow().jobs ?? {})
      expect(jobNames[jobNames.length - 1]).toBe("deploy")
    })
  })

  describe("deploy docs (ADR-0015 + docs sync)", () => {
    const releaseDocs = readFileSync(RELEASE_DOCS_PATH, "utf8")

    it("never lets release.md claim a Release needs no Coolify changes", () => {
      // A guard of a claim that must never be made, not a pin on wording. A
      // Release DOES need a Coolify change: the deploy fires off the Release
      // output, so a reader who believes no Coolify work is required waits for
      // a deploy that never comes. This is the one prose guard the spec keeps
      // by name, and it survives any rewrite — it fails only if the misleading
      // claim is made, never because the sentence around it changed.
      //
      // Compared lowercased, and that is load-bearing rather than fussy. The
      // claim reads as a sentence, so it appears capitalised in at least half
      // its natural forms — at the start of a sentence, a bullet, or a heading.
      // A case-sensitive `not.toContain` here was measured going GREEN against
      // "No Coolify changes are needed for a Release.", i.e. the guard the spec
      // names as the one survivor was defeatable by typing the claim the
      // ordinary way. Lowercasing both sides keeps the claim a guard and stops
      // capitalisation from being a bypass.
      expect(releaseDocs.toLowerCase()).not.toContain(
        "no coolify changes are needed for a release"
      )
      expect(releaseDocs.toLowerCase()).not.toContain("no coolify changes")
    })

    it("does not let CONTEXT.md promote the deploy hop to a term of its own", () => {
      const context = readFileSync(CONTEXT_PATH, "utf8")
      const deployment = context.split("### Deployment")[1] ?? ""
      // Guard of a claim that must never be made, not a pin on wording: a
      // "**Deploy step**" entry would present the deploy as a peer of the
      // existing vocabulary rather than a consequence of the Release entry,
      // which is the shape of argument this file is not supposed to make. It
      // fails only if that heading appears, so rewording is free.
      expect(deployment).not.toContain("**Deploy step**")
    })

    it("keeps every Coolify secret's value out of the deploy docs", () => {
      const docs = [ADR_0015_PATH, RELEASE_DOCS_PATH, CONTEXT_PATH]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n")
      // Guards of absence, not pins on wording. Naming a secret in prose is
      // required — the deploy cannot be documented without saying which
      // secrets it reads — but its VALUE must never be pasted into a document
      // that ships. These fail only if a value appears, so a document can be
      // reworded freely.
      expect(docs).not.toContain("COOLIFY_WEBHOOK=")
      expect(docs).not.toContain("COOLIFY_TOKEN=")
    })
  })
})
