import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import yaml from "js-yaml"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const WORKFLOW_PATH = join(ROOT, ".github/workflows/docker-publish.yml")
const WRAPPER_PATH = join(ROOT, "scripts/test-docker-build.sh")
const CONTEXT_PATH = join(ROOT, "CONTEXT.md")
const RELEASE_DOCS_PATH = join(ROOT, "docs/agents/release.md")
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

function buildAndPublishSteps(): Step[] {
  return loadWorkflow().jobs?.["build-and-publish"]?.steps ?? []
}

function deploySteps(): Step[] {
  return loadWorkflow().jobs?.["deploy"]?.steps ?? []
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
  const gate = buildAndPublishSteps().find((step) => step.id === "release-gate")
  if (!gate) throw new Error("release-gate step not found")
  return gate
}

function metadataSteps(): Step[] {
  return buildAndPublishSteps().filter((step) =>
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

describe(".github/workflows/docker-publish.yml", () => {
  it("parses as YAML", () => {
    expect(() => loadWorkflow()).not.toThrow()
  })

  it("defines the three-job gate: verify, then build-and-publish, then deploy", () => {
    const jobs = loadWorkflow().jobs
    expect(jobs?.["verify"]).toBeDefined()
    expect(jobs?.["build-and-publish"]).toBeDefined()
    expect(jobs?.["deploy"]).toBeDefined()
    expect(jobs?.["build-and-publish"]?.needs).toContain("verify")
    expect(jobs?.["deploy"]?.needs).toContain("build-and-publish")
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
    const runs = runScripts(verifySteps())
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

  it("writes the smoke builds to the GHA cache so verification feeds the publish build", () => {
    const smokeBuildSteps = buildAndPublishSteps().filter(isSmokeBuildStep)
    expect(smokeBuildSteps).toHaveLength(2)
    for (const step of smokeBuildSteps) {
      expect(step.with?.["cache-from"]).toContain("type=gha")
      expect(step.with?.["cache-to"]).toContain("type=gha")
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
    const wrapper = wrapperContents()
    expect(wrapper).not.toContain("npm ls --omit=dev --depth=0")
  })

  it("defines the publish gate term in the deployment documentation", () => {
    const docs = readFileSync(CONTEXT_PATH, "utf8")
    const deployment = docs.split("### Deployment")[1] ?? ""
    expect(deployment).toContain("Publish Gate")
    expect(deployment).toContain("verify")
    expect(deployment).toContain("smoke-test")
  })

  it("wires the local wrapper and the workflow to the same smoke-test module", () => {
    const wrapper = wrapperContents()
    const workflowRuns = runScripts(buildAndPublishSteps())
    expect(wrapper).toContain("smoke-test.sh")
    expect(workflowRuns).toContain("smoke-test.sh")
    expect(wrapper).toContain("--image")
    expect(wrapper).toContain("--migrator-image")
    expect(workflowRuns).toContain("--migrator-image")
  })

  describe("release gate", () => {
    it("runs the release gate right after checkout, before any Docker setup", () => {
      const steps = buildAndPublishSteps()
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
      const computing = buildAndPublishSteps().filter((step) =>
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

    it("derives every release-ness consumer from the gate's single output", () => {
      const steps = buildAndPublishSteps()
      const body = [
        ...steps.map((step) => JSON.stringify(step.with ?? {})),
        ...steps.map((step) => step.if ?? ""),
        runScripts(steps),
      ].join("\n")
      expect(body).not.toContain("release-check")
      expect(body).toContain("steps.release-gate.outputs.is_release")
      for (const step of metadataSteps()) {
        expect(step.with?.tags).toContain(
          "steps.release-gate.outputs.is_release"
        )
      }
      const release = steps.find((step) =>
        step.uses?.includes("softprops/action-gh-release")
      )
      expect(release?.if).toContain("steps.release-gate.outputs.is_release")
    })

    it("keeps the default-branch half of the latest alias inline in both metadata steps", () => {
      const steps = metadataSteps()
      expect(steps).toHaveLength(2)
      for (const step of steps) {
        expect(step.with?.tags).toContain(
          "github.event.repository.default_branch"
        )
      }
    })

    it("keeps the coarse v* trigger so the gate is the single owner of release-ness", () => {
      expect(loadWorkflow().on?.push?.tags).toContain("v*")
    })

    it("documents that malformed tags fail the run and push nothing", () => {
      const releaseDocs = readFileSync(RELEASE_DOCS_PATH, "utf8")
      const adr = readFileSync(ADR_0004_PATH, "utf8")
      expect(releaseDocs).toContain("release-gate")
      expect(releaseDocs).not.toContain("harmless")
      expect(releaseDocs).not.toContain("release-check")
      expect(adr.toLowerCase()).toContain("non-semver tags fail")
      expect(adr).not.toContain("release-check")
    })
  })

  describe("deploy job", () => {
    it("depends on build-and-publish, so verify is transitively covered", () => {
      const deploy = loadWorkflow().jobs?.["deploy"]
      expect(deploy?.needs).toContain("build-and-publish")
    })

    it("promotes the release-gate output to a build-and-publish job output", () => {
      const publish = loadWorkflow().jobs?.["build-and-publish"]
      expect(publish?.outputs?.is_release).toContain(
        "steps.release-gate.outputs.is_release"
      )
    })

    it("deploys only on the exact single-owner gate: Release output, or an explicit dry-run dispatch", () => {
      const deploy = loadWorkflow().jobs?.["deploy"]
      expect(deploy?.if).toBe(
        "needs.build-and-publish.outputs.is_release == 'true' || (github.event_name == 'workflow_dispatch' && inputs.deploy-dry-run == 'true')"
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
    const adr = readFileSync(ADR_0015_PATH, "utf8")
    const releaseDocs = readFileSync(RELEASE_DOCS_PATH, "utf8")

    it("records the who-pulls decision in ADR-0015 and cites ADR-0004", () => {
      expect(adr).toContain("Coolify deploy webhook")
      expect(adr).toContain("Release tags")
      expect(adr).toContain("Bearer")
      expect(adr).toContain("HTTP 2xx")
      expect(adr).toContain("latest")
      expect(adr).toContain("ADR-0004")
    })

    it("records the publish gate as the trust precondition for auto-deploy", () => {
      expect(adr.toLowerCase()).toContain("trust precondition")
      expect(adr.toLowerCase()).toContain("publish gate")
    })

    it("release.md drops the no-Coolify-changes claim and documents the deploy + escape hatch", () => {
      expect(releaseDocs).not.toContain(
        "no Coolify changes are needed for a Release"
      )
      expect(releaseDocs).not.toContain("no Coolify changes")
      expect(releaseDocs).toContain("Coolify deploy webhook")
      expect(releaseDocs).toContain("escape hatch")
    })

    it("describes the deploy hop in the release process overview", () => {
      const overview =
        releaseDocs
          .split("## Process overview")[1]
          ?.split("## When to cut a Release")[0] ?? ""
      expect(overview).toContain("Coolify deploy webhook")
      expect(overview).toContain("queued to serve")
    })

    it("CONTEXT.md Release entry gains the deploy-step consequence without a new term", () => {
      const context = readFileSync(CONTEXT_PATH, "utf8")
      const deployment = context.split("### Deployment")[1] ?? ""
      const releaseEntry = deployment.split("**Release**")[1] ?? ""
      expect(releaseEntry).toContain("Coolify deploy webhook")
      expect(releaseEntry).toContain("ADR-0015")
      expect(deployment).not.toContain("**Deploy step**")
    })

    it("references the Coolify secrets by name only across the deploy docs", () => {
      const docs = [ADR_0015_PATH, RELEASE_DOCS_PATH, CONTEXT_PATH]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n")
      expect(docs).toContain("COOLIFY_WEBHOOK")
      expect(docs).toContain("COOLIFY_TOKEN")
      expect(docs).not.toContain("COOLIFY_WEBHOOK=")
      expect(docs).not.toContain("COOLIFY_TOKEN=")
    })

    it("documents the deploy exactly as the workflow ships it", () => {
      const deploy = loadWorkflow().jobs?.["deploy"] ?? {}
      expect(releaseDocs).toContain("needs: build-and-publish")
      expect(releaseDocs).toContain("deploy-coolify.sh")
      expect(releaseDocs).toContain("HTTP 2xx")
      expect(releaseDocs).toContain("Branch pushes")
      expect(releaseDocs).toContain("deploy nothing")
      expect(deploy.if).toContain("is_release")
      expect(deploy.if).toContain("deploy-dry-run")
    })
  })
})
