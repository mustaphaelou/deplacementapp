import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const dockerfilePath = join(dirname(fileURLToPath(import.meta.url)), "..", "Dockerfile")
const dockerfile = readFileSync(dockerfilePath, "utf8")

describe("Dockerfile migrator stage", () => {
  it("uses versioned drizzle migrations", () => {
    expect(dockerfile).toContain('CMD ["npx", "drizzle-kit", "migrate"]')
    expect(dockerfile).not.toContain('CMD ["npx", "drizzle-kit", "push"]')
  })
})
