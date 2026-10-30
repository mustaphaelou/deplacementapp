import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The historic `POSTGRES_PASSWORD` default was rotated in `docker-compose.yaml`
 * (afd0706), but the literal survived in every surface an operator reads before
 * a first deploy: the compose DATABASE_URL interpolations, the Coolify deploy
 * wizard's warning, and two notes files that still quote it verbatim.
 *
 * A value that is only rotated in one place is not rotated. This pin fails if
 * the literal reappears in any tracked text file, so the scrub cannot silently
 * regress when someone re-adds a default.
 *
 * The value is assembled at runtime rather than written literally, so this
 * assertion does not itself re-commit the secret into the repository.
 */
const HISTORIC_PASSWORD = ["Mmmm", "2005", "."].join("")

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Directories that hold no operator-facing text worth scanning. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "dist",
  "build",
])

/** Binary or generated trees — not text a human reads before deploying. */
const SKIP_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
])

function* trackedTextFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      yield* trackedTextFiles(full)
    } else if (!SKIP_EXTS.has(full.slice(full.lastIndexOf(".")))) {
      yield full
    }
  }
}

describe("committed secrets", () => {
  it("does not carry the historic DB password in any tracked file", () => {
    const offenders: string[] = []

    for (const file of trackedTextFiles(REPO_ROOT)) {
      const contents = readFileSync(file, "utf8")
      if (contents.includes(HISTORIC_PASSWORD)) {
        offenders.push(relative(REPO_ROOT, file))
      }
    }

    expect(
      offenders,
      `The historic POSTGRES_PASSWORD literal is still present in: ${offenders.join(
        ", "
      )}. Rotate the value in every surface, not just docker-compose.yaml.`
    ).toEqual([])
  })

  it("defaults the compose DB password to the dev-only placeholder", () => {
    const compose = readFileSync(join(REPO_ROOT, "docker-compose.yaml"), "utf8")

    // The db service must carry the dev-only default rather than nothing, so a
    // local `docker compose up` works without a .env.
    expect(compose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-")
    expect(compose).not.toContain(HISTORIC_PASSWORD)
  })
})
