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

  it("defines the publish gate term in the deployment documentation", () => {
    const docs = readFileSync(CONTEXT_PATH, "utf8")
    const deployment = docs.split("### Deployment")[1] ?? ""
    expect(deployment).toContain("Publish Gate")
    expect(deployment).toContain("verify")
    expect(deployment).toContain("publish-check")
    expect(deployment).toContain("smoke-test")
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

    it("records the twin-block deepening candidate as closed in ADR-0004", () => {
      const adr = readFileSync(ADR_0004_PATH, "utf8")
      expect(adr).toContain("image map")
      expect(adr).toContain("source of truth")
      expect(adr).toContain("known wart")
      expect(adr).toContain("deplacementapp-migrator")
      expect(adr).toContain("Future architecture reviews should not")
      expect(adr).toContain("twin-block deepening candidate is closed")
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
      expect(tags).toContain("github.event.repository.default_branch")
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
      const deploy = job("deploy")
      expect(releaseDocs).toContain("needs: build-and-push")
      expect(releaseDocs).toContain("deploy-coolify.sh")
      expect(releaseDocs).toContain("HTTP 2xx")
      expect(releaseDocs).toContain("Branch pushes")
      expect(releaseDocs).toContain("deploy nothing")
      expect(deploy.if).toContain("is_release")
      expect(deploy.if).toContain("deploy-dry-run")
    })
  })
})
