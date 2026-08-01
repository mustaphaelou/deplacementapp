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
  on?: Record<string, unknown>
  jobs?: Record<string, Job>
}

function loadWorkflow(): Workflow {
  const raw = readFileSync(WORKFLOW_PATH, "utf8")
  return yaml.load(raw) as Workflow
}

function findStepIndex(job: Job, predicate: (step: Step) => boolean): number {
  return (job.steps ?? []).findIndex(predicate)
}

describe(".github/workflows/docker-publish.yml", () => {
  it("parses as YAML", () => {
    expect(() => loadWorkflow()).not.toThrow()
  })

  it("defines the two-job gate: verify, then build-and-publish depending on it", () => {
    const workflow = loadWorkflow()
    const jobs = workflow.jobs ?? {}
    expect(jobs.verify).toBeDefined()
    expect(jobs["build-and-publish"]).toBeDefined()
    const needs = jobs["build-and-publish"].needs
    expect(needs).toContain("verify")
  })

  it("runs unit checks on every trigger, including pull requests", () => {
    const workflow = loadWorkflow()
    expect(workflow.on?.["pull_request"]).toBeDefined()
    expect(workflow.on?.["workflow_dispatch"]).toBeDefined()
    const push = workflow.on?.["push"] as {
      branches?: string[]
      tags?: string[]
    }
    expect(push.branches).toContain("main")
    expect(push.tags).toContain("v*")
  })

  it("keeps pull requests to unit checks only (no Docker builds, publish job skipped)", () => {
    const workflow = loadWorkflow()
    const verify = workflow.jobs?.["verify"]
    const dockerBuilds = (verify?.steps ?? []).filter((step) =>
      step.uses?.includes("docker/build-push-action")
    )
    expect(dockerBuilds).toHaveLength(0)
    const publish = workflow.jobs?.["build-and-publish"]
    expect(publish?.if).toContain("github.event_name")
    expect(publish?.if).toContain("pull_request")
  })

  it("runs lint, typecheck, the unit tests, and the production dependency-tree check in verify", () => {
    const workflow = loadWorkflow()
    const runs = (workflow.jobs?.["verify"]?.steps ?? [])
      .map((step) => step.run ?? "")
      .join("\n")
    expect(runs).toContain("npm run lint")
    expect(runs).toContain("npm run typecheck")
    expect(runs).toContain("npm run test")
    expect(runs).toContain("npm ls --omit=dev")
  })

  it("smoke-tests both loaded images before anything is pushed", () => {
    const workflow = loadWorkflow()
    const job = workflow.jobs?.["build-and-publish"]
    const steps = job?.steps ?? []

    const smokeBuildIndices = steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step }) =>
          step.uses?.includes("docker/build-push-action") &&
          step.with?.load === true
      )
    expect(smokeBuildIndices).toHaveLength(2)
    for (const { step } of smokeBuildIndices) {
      expect(step.with?.platforms).toBe("linux/amd64")
      expect(step.with?.push).toBeUndefined()
    }
    const lastSmokeBuildIndex = Math.max(
      ...smokeBuildIndices.map(({ index }) => index)
    )

    const smokeTestIndex = findStepIndex(job!, (step) =>
      (step.run ?? "").includes("smoke-test.sh")
    )
    expect(smokeTestIndex).toBeGreaterThan(-1)
    expect(smokeTestIndex).toBeGreaterThan(lastSmokeBuildIndex)
    const smokeTestRun = steps[smokeTestIndex].run ?? ""
    expect(smokeTestRun).toContain("--image")
    expect(smokeTestRun).toContain("--migrator-image")

    const pushIndices = steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step }) =>
          step.uses?.includes("docker/build-push-action") &&
          step.with?.push === true
      )
      .map(({ index }) => index)
    expect(pushIndices).toHaveLength(2)
    for (const index of pushIndices) {
      expect(index).toBeGreaterThan(smokeTestIndex)
    }
  })

  it("publishes both images multi-arch and reuses the smoke build's GHA cache", () => {
    const workflow = loadWorkflow()
    const steps = workflow.jobs?.["build-and-publish"]?.steps ?? []
    const pushSteps = steps.filter(
      (step) =>
        step.uses?.includes("docker/build-push-action") &&
        step.with?.push === true
    )
    expect(pushSteps).toHaveLength(2)
    for (const step of pushSteps) {
      expect(step.with?.platforms).toContain("linux/amd64")
      expect(step.with?.platforms).toContain("linux/arm64")
      expect(step.with?.["cache-from"]).toContain("type=gha")
    }
  })

  it("keeps the draft-Release step after every push, so a failed gate creates no Release", () => {
    const workflow = loadWorkflow()
    const steps = workflow.jobs?.["build-and-publish"]?.steps ?? []
    const releaseIndex = steps.findIndex((step) =>
      step.uses?.includes("softprops/action-gh-release")
    )
    expect(releaseIndex).toBeGreaterThan(-1)
    const lastPushIndex = Math.max(
      ...steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) => step.with?.push === true)
        .map(({ index }) => index)
    )
    expect(Number.isFinite(lastPushIndex)).toBe(true)
    expect(releaseIndex).toBeGreaterThan(lastPushIndex)
  })

  it("no longer runs the production dependency-tree check in the local wrapper", () => {
    const wrapper = readFileSync(WRAPPER_PATH, "utf8")
    expect(wrapper).not.toContain("npm ls --omit=dev --depth=0")
  })
})
