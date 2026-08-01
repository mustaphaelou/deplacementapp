import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const WORKFLOW_PATH = join(ROOT, ".github/workflows/docker-publish.yml")
const WRAPPER_PATH = join(ROOT, "scripts/test-docker-build.sh")

interface Step {
  name?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, unknown>
}

interface Job {
  if?: string
  needs?: string | string[]
  steps?: Step[]
}

interface Workflow {
  on?: {
    pull_request?: unknown
    push?: {
      branches?: string[]
      tags?: string[]
    }
    workflow_dispatch?: unknown
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

function buildAndPublishSteps(): Step[] {
  return loadWorkflow().jobs?.["build-and-publish"]?.steps ?? []
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

describe(".github/workflows/docker-publish.yml", () => {
  it("parses as YAML", () => {
    expect(() => loadWorkflow()).not.toThrow()
  })

  it("defines the two-job gate: verify, then build-and-publish depending on it", () => {
    const jobs = loadWorkflow().jobs
    expect(jobs?.["verify"]).toBeDefined()
    expect(jobs?.["build-and-publish"]).toBeDefined()
    expect(jobs?.["build-and-publish"]?.needs).toContain("verify")
  })

  it("runs the unit gate on every trigger, including pull requests", () => {
    const on = loadWorkflow().on
    expect(on?.pull_request).toBeDefined()
    expect(on?.workflow_dispatch).toBeDefined()
    expect(on?.push?.branches).toContain("main")
    expect(on?.push?.tags).toContain("v*")
  })

  it("keeps pull requests to unit checks only (no Docker builds, publish job skipped)", () => {
    const dockerBuilds = verifySteps().filter(isDockerBuildStep)
    expect(dockerBuilds).toHaveLength(0)
    const publish = loadWorkflow().jobs?.["build-and-publish"]
    expect(publish?.if).toContain("github.event_name")
    expect(publish?.if).toContain("pull_request")
  })

  it("runs lint, typecheck, the unit tests, and the production dependency-tree check in verify", () => {
    const runs = verifySteps()
      .map((step) => step.run ?? "")
      .join("\n")
    expect(runs).toContain("npm run lint")
    expect(runs).toContain("npm run typecheck")
    expect(runs).toContain("npm run test")
    expect(runs).toContain("npm ls --omit=dev")
  })

  it("smoke-tests both loaded images before anything is pushed", () => {
    const steps = buildAndPublishSteps()
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

    const pushIndices = dockerBuildStepIndices(steps, isPushStep)
    expect(pushIndices).toHaveLength(2)
    for (const index of pushIndices) {
      expect(index).toBeGreaterThan(smokeTestIndex)
    }
  })

  it("publishes both images multi-arch and reuses the smoke build's GHA cache", () => {
    const pushSteps = buildAndPublishSteps().filter(isPushStep)
    expect(pushSteps).toHaveLength(2)
    for (const step of pushSteps) {
      expect(step.with?.platforms).toContain("linux/amd64")
      expect(step.with?.platforms).toContain("linux/arm64")
      expect(step.with?.["cache-from"]).toContain("type=gha")
    }
  })

  it("keeps the draft-Release step after every push, so a failed gate creates no Release", () => {
    const steps = buildAndPublishSteps()
    const releaseIndex = steps.findIndex((step) =>
      step.uses?.includes("softprops/action-gh-release")
    )
    expect(releaseIndex).toBeGreaterThan(-1)
    const lastPushIndex = Math.max(...dockerBuildStepIndices(steps, isPushStep))
    expect(Number.isFinite(lastPushIndex)).toBe(true)
    expect(releaseIndex).toBeGreaterThan(lastPushIndex)
  })

  it("keeps the production dependency-tree check out of the local wrapper", () => {
    const wrapper = readFileSync(WRAPPER_PATH, "utf8")
    expect(wrapper).not.toContain("npm ls --omit=dev --depth=0")
  })
})
