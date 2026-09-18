import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  resolveSecret,
  resolveAuthSecret,
  isDevOnlyValue,
  MIN_SECRET_LENGTH,
} from "./secret-guard"

const REAL_SECRET = "prod-secret-0123456789-abcdefghijklmnopqrstuvwxyz-01"
const DEV_SECRET = "dev-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz"

const SAVED_ENV = { ...process.env }

function asProduction() {
  process.env.NODE_ENV = "production"
  delete process.env.NEXT_PHASE
}

beforeEach(() => {
  process.env = { ...SAVED_ENV }
  delete process.env.BETTER_AUTH_SECRET
  delete process.env.NEXT_PHASE
})

afterEach(() => {
  process.env = { ...SAVED_ENV }
})

describe("isDevOnlyValue", () => {
  it("flags dev-only placeholders regardless of case", () => {
    expect(isDevOnlyValue(DEV_SECRET)).toBe(true)
    expect(isDevOnlyValue("DEV-ONLY-change-me")).toBe(true)
    expect(isDevOnlyValue(REAL_SECRET)).toBe(false)
  })
})

describe("resolveSecret in production", () => {
  it("throws when the secret is missing", () => {
    asProduction()
    expect(() => resolveAuthSecret()).toThrow(/required in production/i)
  })

  it("throws when the secret is a dev-only placeholder", () => {
    asProduction()
    process.env.BETTER_AUTH_SECRET = DEV_SECRET
    expect(() => resolveAuthSecret()).toThrow(/dev-only/i)
  })

  it("throws when an explicit dev-only value is passed", () => {
    asProduction()
    expect(() => resolveAuthSecret(DEV_SECRET)).toThrow(/dev-only/i)
  })

  it("throws when the secret is shorter than the minimum", () => {
    asProduction()
    process.env.BETTER_AUTH_SECRET = "short-but-not-dev"
    expect(() => resolveAuthSecret()).toThrow(
      new RegExp(`at least ${MIN_SECRET_LENGTH}`),
    )
  })

  it("returns a real secret untouched", () => {
    asProduction()
    process.env.BETTER_AUTH_SECRET = REAL_SECRET
    expect(resolveAuthSecret()).toBe(REAL_SECRET)
  })

  it("prefers the explicit value over the environment", () => {
    asProduction()
    process.env.BETTER_AUTH_SECRET = REAL_SECRET
    const other = `${REAL_SECRET}-explicit`
    expect(resolveAuthSecret(other)).toBe(other)
  })

  it("is exempt during the Next.js production build phase", () => {
    asProduction()
    process.env.NEXT_PHASE = "phase-production-build"
    expect(resolveAuthSecret()).toBeUndefined()
    process.env.BETTER_AUTH_SECRET = DEV_SECRET
    expect(resolveAuthSecret()).toBe(DEV_SECRET)
  })
})

describe("resolveSecret outside production", () => {
  it("passes dev-only and missing values through (dev/test workflow)", () => {
    process.env.NODE_ENV = "test"
    process.env.BETTER_AUTH_SECRET = DEV_SECRET
    expect(resolveAuthSecret()).toBe(DEV_SECRET)
    delete process.env.BETTER_AUTH_SECRET
    expect(resolveAuthSecret()).toBeUndefined()
    expect(resolveSecret("MISSING_VAR", undefined)).toBeUndefined()
  })
})
