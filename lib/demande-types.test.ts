import { expect, describe, it } from "vitest"
import { parseMotif } from "./demande-types"

describe("parseMotif", () => {
  it("parses a valid JSON array string", () => {
    expect(parseMotif('["Réunion client","Formation"]')).toEqual(["Réunion client", "Formation"])
  })

  it("parses a single-element array", () => {
    expect(parseMotif('["Mission"]')).toEqual(["Mission"])
  })

  it("falls back to single-element array for plain string", () => {
    expect(parseMotif("not-json")).toEqual(["not-json"])
  })

  it("falls back for null string", () => {
    expect(parseMotif("null")).toEqual(["null"])
  })

  it("falls back to single-element array when JSON.parse returns non-array", () => {
    expect(parseMotif('"just a string"')).toEqual(['"just a string"'])
  })

  it("falls back for empty string", () => {
    expect(parseMotif("")).toEqual([""])
  })

  it("falls back for malformed JSON", () => {
    expect(parseMotif("{bad json}")).toEqual(["{bad json}"])
  })
})
