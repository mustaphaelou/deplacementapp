import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  readCollapsed,
  writeCollapsed,
  subscribeToCollapse,
} from "@/lib/sidebar-collapse"

function fakeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  } as Storage
}

describe("sidebar collapse preference", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads false when no preference is stored", () => {
    expect(readCollapsed()).toBe(false)
  })

  it("persists the written value and reads it back", () => {
    writeCollapsed(true)
    expect(readCollapsed()).toBe(true)

    writeCollapsed(false)
    expect(readCollapsed()).toBe(false)
  })

  it("notifies subscribers when the value changes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToCollapse(listener)

    writeCollapsed(true)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    writeCollapsed(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
