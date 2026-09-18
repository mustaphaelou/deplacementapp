/**
 * Regression test for fail-closed production secrets.
 *
 * The prod compose path (`npm run docker:prod` = docker-compose.yaml +
 * compose.prod.yml) must refuse to start when POSTGRES_PASSWORD or
 * BETTER_AUTH_SECRET is unset — via `${VAR:?}` gates — and must not carry
 * dev-only fallback defaults. Dev defaults live in compose.dev.yml only, so
 * `npm run docker:dev` keeps working with zero configuration.
 */
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const read = (name: string) => fs.readFileSync(path.join(ROOT, name), "utf-8")

const SECRETS = ["POSTGRES_PASSWORD", "BETTER_AUTH_SECRET"]

describe("prod compose path fails closed on missing secrets", () => {
  it("gates every secret with ${VAR:?} in compose.prod.yml", () => {
    const prod = read("compose.prod.yml")
    for (const name of SECRETS) {
      expect(prod, `${name} must have a :? gate in compose.prod.yml`).toMatch(
        new RegExp(`\\$\\{${name}:\\?`),
      )
    }
  })

  it("carries no dev-only fallback defaults in the prod path files", () => {
    for (const file of ["docker-compose.yaml", "compose.prod.yml"]) {
      const content = read(file)
      expect(content, `${file} must not contain dev-only values`).not.toMatch(
        /dev-only/,
      )
      for (const name of SECRETS) {
        expect(
          content,
          `${file} must not define a fallback default for ${name}`,
        ).not.toMatch(new RegExp(`\\$\\{${name}:-[^?]`))
      }
    }
  })

  it("runs the prod overlay via docker:prod", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["docker:prod"]).toContain("compose.prod.yml")
    expect(pkg.scripts["docker:prod"]).toContain("docker-compose.yaml")
  })

  it("documents the fail-closed layout in .env.example", () => {
    const example = read(".env.example")
    // The old header claimed the base compose file held ${VAR:?} gates that
    // did not exist; the gates live in the prod overlay now.
    expect(example).toContain("compose.prod.yml")
    expect(example).not.toMatch(/compose\.yaml marks/)
  })
})

describe("dev workflow keeps working without configuration", () => {
  it("supplies throwaway defaults for secrets in compose.dev.yml only", () => {
    const dev = read("compose.dev.yml")
    for (const name of SECRETS) {
      expect(dev, `${name} must keep a dev default`).toMatch(
        new RegExp(`\\$\\{${name}:-[^?]+\\}`),
      )
    }
  })

  it("still merges the dev overlay via docker:dev", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts["docker:dev"]).toContain("compose.dev.yml")
  })
})
