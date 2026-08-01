import { describe, it, expect, beforeAll } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "smoke-test.sh")

const RUNNER_IMAGE = "deplacementapp:test"
const MIGRATOR_IMAGE = "deplacementapp-migrator:test"

const DOCKER_STUB = `#!/usr/bin/env bash
set -u
cmd="\${1:-}"
case "$cmd" in
  network)
    if [ "\${2:-}" = "create" ]; then echo "smoke-net-id"; fi
    exit 0
    ;;
  inspect)
    if [[ "\${*}" == *".Size"* ]]; then
      echo "\${IMAGE_SIZE_BYTES:-838860800}"
    elif [[ "\${*}" == *"Health.Status"* ]]; then
      echo "\${HEALTH_STATUS:-healthy}"
    else
      echo ""
    fi
    exit 0
    ;;
  images)
    echo "\${IMAGE_SIZE_HUMAN:-800MB}"
    exit 0
    ;;
  run)
    detached=0
    for arg in "$@"; do
      if [ "$arg" = "-d" ]; then detached=1; fi
    done
    if [ "$detached" = "1" ]; then
      echo "\${RUNNER_CONTAINER_NAME:-deplacementapp-smoke-runner}"
      exit 0
    fi
    exit "\${MIGRATOR_EXIT:-0}"
    ;;
  exec)
    exit 0
    ;;
  ps)
    if [ "\${PS_EMPTY:-}" = "1" ]; then exit 0; fi
    echo "\${RUNNER_CONTAINER_NAME:-deplacementapp-smoke-runner}"
    exit 0
    ;;
  logs)
    echo "STUB-LOG-LINE runner failed to boot"
    exit 0
    ;;
  stop|rm)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`

const CURL_STUB = `#!/usr/bin/env bash
exit "\${CURL_EXIT:-0}"
`

interface RunResult {
  code: number | null
  output: string
}

function runSmokeTest(args: string[], env: Record<string, string> = {}): RunResult {
  const stubDir = mkdtempSync(join(tmpdir(), "smoke-test-stub-"))
  writeFileSync(join(stubDir, "docker"), DOCKER_STUB, { mode: 0o755 })
  writeFileSync(join(stubDir, "curl"), CURL_STUB, { mode: 0o755 })
  const result = spawnSync("bash", [SCRIPT, ...args], {
    env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, ...env },
    encoding: "utf8",
    timeout: 30000,
  })
  rmSync(stubDir, { recursive: true, force: true })
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` }
}

describe("scripts/smoke-test.sh", () => {
  beforeAll(() => {
    expect(existsSync(SCRIPT)).toBe(true)
  })

  it("exits 0 when the runner boots, passes its HEALTHCHECK, and serves /api/health", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE])
    expect(result.code).toBe(0)
  })

  it("exits 0 with a successful migrator run", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE, "--migrator-image", MIGRATOR_IMAGE])
    expect(result.code).toBe(0)
  })

  it("requires the --image parameter", () => {
    const result = runSmokeTest([])
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("--image")
  })

  it("rejects unknown parameters", () => {
    const result = runSmokeTest(["--bogus", "x"])
    expect(result.code).not.toBe(0)
  })

  it("exits non-zero with a diagnostic log tail when the HEALTHCHECK is unhealthy", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE], { HEALTH_STATUS: "unhealthy" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("Container logs")
    expect(result.output).toContain("STUB-LOG-LINE")
  })

  it("exits non-zero when the health endpoint fails", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE], { CURL_EXIT: "1" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("Health endpoint returned non-200")
  })

  it("exits non-zero when the migrator exits non-zero", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE, "--migrator-image", MIGRATOR_IMAGE], {
      MIGRATOR_EXIT: "1",
    })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("Migrator exited non-zero")
  })

  it("exits non-zero when the image exceeds the size limit", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE], { IMAGE_SIZE_BYTES: "2000000000" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("exceeds limit")
  })

  it("exits non-zero when the runner container stops after health", () => {
    const result = runSmokeTest(["--image", RUNNER_IMAGE], { PS_EMPTY: "1" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("no longer running")
  })
})
