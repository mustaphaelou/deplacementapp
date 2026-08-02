import { describe, it, expect, beforeAll } from "vitest"
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "deploy-coolify.sh")

const WEBHOOK = "https://coolify.example.com/api/v1/deploy?uuid=abc-123-secret"
const TOKEN = "sensitive-token-value-xyz"
const REF = "v0.1.0"

const CURL_STUB = `#!/usr/bin/env bash
set -u
if [ -n "\${CURL_CALL_LOG:-}" ]; then
  printf '%s\n' "$*" >> "\$CURL_CALL_LOG"
fi
if [ "\${CURL_NETWORK_ERROR:-0}" = "1" ]; then
  echo "curl: (7) Failed to connect" >&2
  exit 7
fi
prev=""
for arg in "$@"; do
  if [ "\$prev" = "--write-out" ]; then
    printf '%s' "\${HTTP_CODE:-200}"
  fi
  prev="\$arg"
done
exit "\${CURL_EXIT:-0}"
`

interface RunResult {
  code: number | null
  output: string
}

function runDeploy(
  args: string[],
  env: Record<string, string> = {}
): RunResult {
  const stubDir = mkdtempSync(join(tmpdir(), "deploy-coolify-stub-"))
  writeFileSync(join(stubDir, "curl"), CURL_STUB, { mode: 0o755 })
  const base = { COOLIFY_WEBHOOK: WEBHOOK, COOLIFY_TOKEN: TOKEN }
  const result = spawnSync("bash", [SCRIPT, ...args], {
    env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, ...base, ...env },
    encoding: "utf8",
    timeout: 30000,
  })
  rmSync(stubDir, { recursive: true, force: true })
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` }
}

describe("scripts/deploy-coolify.sh", () => {
  beforeAll(() => {
    expect(existsSync(SCRIPT)).toBe(true)
  })

  it("is executable so the workflow can invoke it directly", () => {
    expect(statSync(SCRIPT).mode & 0o111).not.toBe(0)
  })

  it("exits 0 with a short success line when the deploy webhook answers HTTP 2xx", () => {
    const result = runDeploy(["--ref", REF])
    expect(result.code).toBe(0)
    expect(result.output).toContain("[PASS]")
    expect(result.output).toContain("Deploy webhook accepted")
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("exits non-zero with a diagnostic when the webhook answers non-2xx", () => {
    const result = runDeploy(["--ref", REF], { HTTP_CODE: "500" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("HTTP 500")
  })

  it("never prints the webhook URL or token values on a 5xx response", () => {
    const result = runDeploy(["--ref", REF], { HTTP_CODE: "500" })
    expect(result.code).not.toBe(0)
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("exits non-zero when curl fails (network error)", () => {
    const result = runDeploy(["--ref", REF], { CURL_NETWORK_ERROR: "1" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("network error")
  })

  it("never prints the webhook URL or token values on a network error", () => {
    const result = runDeploy(["--ref", REF], { CURL_NETWORK_ERROR: "1" })
    expect(result.code).not.toBe(0)
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("exits non-zero naming the missing variable when COOLIFY_WEBHOOK is missing", () => {
    const result = runDeploy(["--ref", REF], { COOLIFY_WEBHOOK: "" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("COOLIFY_WEBHOOK")
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("exits non-zero naming the missing variable when COOLIFY_TOKEN is missing", () => {
    const result = runDeploy(["--ref", REF], { COOLIFY_TOKEN: "" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("COOLIFY_TOKEN")
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("never prints COOLIFY_WEBHOOK or COOLIFY_TOKEN values", () => {
    const result = runDeploy(["--ref", REF])
    expect(result.code).toBe(0)
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("--dry-run exits 0 without firing a request and never prints secrets", () => {
    const logDir = mkdtempSync(join(tmpdir(), "deploy-coolify-log-"))
    const logPath = join(logDir, "calls.log")
    const result = runDeploy(["--dry-run", "--ref", REF], {
      CURL_CALL_LOG: logPath,
    })
    expect(result.code).toBe(0)
    expect(existsSync(logPath)).toBe(false)
    expect(result.output).toContain(REF)
    expect(result.output).toContain("coolify.example.com")
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
    rmSync(logDir, { recursive: true, force: true })
  })

  it("--dry-run still validates secret presence, naming the missing variable without a value", () => {
    const result = runDeploy(["--dry-run", "--ref", REF], { COOLIFY_TOKEN: "" })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("COOLIFY_TOKEN")
    expect(result.output).not.toContain(TOKEN)
    expect(result.output).not.toContain("abc-123-secret")
  })

  it("names curl as the cause when curl is not installed", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "deploy-coolify-nocurl-"))
    symlinkSync("/bin/bash", join(emptyDir, "bash"))
    const result = spawnSync("bash", [SCRIPT, "--ref", REF], {
      env: {
        ...process.env,
        PATH: emptyDir,
        COOLIFY_WEBHOOK: WEBHOOK,
        COOLIFY_TOKEN: TOKEN,
      },
      encoding: "utf8",
      timeout: 30000,
    })
    rmSync(emptyDir, { recursive: true, force: true })
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain("Curl")
  })

  it("is standalone: a one-shot curl-based module with no workflow-template interpolation", () => {
    const body = readFileSync(SCRIPT, "utf8")
    expect(body).toContain("#!/usr/bin/env bash")
    expect(body).toContain("curl")
    expect(body).not.toContain("${{")
  })

  it("rejects unknown parameters", () => {
    const result = runDeploy(["--bogus", "x"])
    expect(result.code).not.toBe(0)
  })
})
