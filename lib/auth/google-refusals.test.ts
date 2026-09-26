/**
 * The pin over the engine's code vocabulary (#247).
 *
 * `GOOGLE_ENGINE_REFUSAL_MESSAGES` names codes the engine emits.  That list is
 * not a public API: it is read out of the installed `better-auth` distribution,
 * and an upgrade can rename a code or drop one.  When it does, the message
 * silently stops being reachable — the code takes the generic fallback and the
 * exact regression #247 was written up from comes back, with nothing failing.
 *
 * So this suite re-reads the engine's own source and fails when a code we map
 * is no longer emitted there.  The message-mapping tests elsewhere pin the
 * *copy*; this one pins the *contract with the engine*.
 *
 * `access_denied` is excluded by construction, not by exception list: it is
 * Google's own code, forwarded verbatim by the engine's callback
 * (`if (error) redirectOnError(error, error_description)`), so it appears in no
 * engine list — the engine relays whatever Google sends.
 */
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import {
  GOOGLE_ENGINE_REFUSAL_MESSAGES,
  GOOGLE_REFUSAL_MESSAGES,
  isMappedGoogleRefusalCode,
  googleRefusalMessage,
  GOOGLE_REFUSAL_FALLBACK_MESSAGE,
} from "./google-refusals"

const ENGINE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../node_modules/better-auth/dist"
)

function engineSource(relative: string): string {
  return fs.readFileSync(path.join(ENGINE_ROOT, relative), "utf8")
}

/** Every code the engine can redirect a callback with, per its own source. */
function engineEmittedCodes(): Set<string> {
  const codes = new Set<string>()
  const collect = (source: string, pattern: RegExp) => {
    for (const match of source.matchAll(pattern)) codes.add(match[1])
  }
  // OAUTH_CALLBACK_ERROR_CODES: `KEY: "value"`
  collect(engineSource("oauth2/errors.mjs"), /^\s+[A-Z_]+: "([a-z_]+)"/gm)
  // StateError codes: `code: "value"`
  collect(engineSource("state.mjs"), /code: "([a-z_]+)"/g)
  // codes the callback route redirects with inline
  collect(
    engineSource("api/routes/callback.mjs"),
    /new URLSearchParams\(\{ error: "([a-z_]+)" \}\)/g
  )
  return codes
}

/** The codes Google itself can forward, which the engine relays untouched. */
const GOOGLE_PASSTHROUGH_CODES = new Set(["access_denied"])

describe("the engine code vocabulary is pinned", () => {
  const emitted = engineEmittedCodes()

  it("reads a non-empty vocabulary out of the installed engine", () => {
    // A regex that silently stops matching (an engine reformatting its source)
    // would turn every assertion below into a vacuous one.
    expect(emitted.size).toBeGreaterThan(10)
    expect(emitted).toContain("invalid_code")
    expect(emitted).toContain("state_not_found")
  })

  it("still emits every engine code this app maps", () => {
    const engineCodes = Object.keys(GOOGLE_ENGINE_REFUSAL_MESSAGES).filter(
      (code) => !GOOGLE_PASSTHROUGH_CODES.has(code)
    )

    expect(engineCodes.length).toBeGreaterThan(0)
    const missing = engineCodes.filter((code) => !emitted.has(code))
    expect(missing).toEqual([])
  })

  it("reaches a message, not the fallback, for every code it maps", () => {
    for (const code of Object.keys(GOOGLE_ENGINE_REFUSAL_MESSAGES)) {
      expect(googleRefusalMessage(code)).not.toBe(
        GOOGLE_REFUSAL_FALLBACK_MESSAGE
      )
      expect(isMappedGoogleRefusalCode(code)).toBe(true)
    }
  })
})

describe("the two vocabularies stay distinct", () => {
  it("keeps the gate's codes out of the engine's map and the reverse", () => {
    const gateCodes = Object.keys(GOOGLE_REFUSAL_MESSAGES)
    const engineCodes = Object.keys(GOOGLE_ENGINE_REFUSAL_MESSAGES)

    expect(gateCodes.filter((c) => engineCodes.includes(c))).toEqual([])
    expect(engineCodes.filter((c) => gateCodes.includes(c))).toEqual([])
  })

  it("never answers with the fallback for a mapped code", () => {
    for (const code of [
      ...Object.keys(GOOGLE_REFUSAL_MESSAGES),
      ...Object.keys(GOOGLE_ENGINE_REFUSAL_MESSAGES),
    ]) {
      expect(googleRefusalMessage(code)).not.toBe(
        GOOGLE_REFUSAL_FALLBACK_MESSAGE
      )
    }
  })

  it("answers with the fallback for a code neither vocabulary names", () => {
    for (const code of [null, undefined, "", "some_future_engine_code"]) {
      expect(googleRefusalMessage(code)).toBe(GOOGLE_REFUSAL_FALLBACK_MESSAGE)
      expect(isMappedGoogleRefusalCode(code)).toBe(false)
    }
  })

  it("does not answer for a prototype key", () => {
    // `hasOwnProperty` is the guard: a code of `constructor` or `toString`
    // must not resolve to a function.
    expect(googleRefusalMessage("constructor")).toBe(
      GOOGLE_REFUSAL_FALLBACK_MESSAGE
    )
    expect(googleRefusalMessage("__proto__")).toBe(
      GOOGLE_REFUSAL_FALLBACK_MESSAGE
    )
  })
})
