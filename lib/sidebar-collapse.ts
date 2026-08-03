const COLLAPSED_KEY = "sidebar-collapsed"

const collapseListeners = new Set<() => void>()

export function subscribeToCollapse(listener: () => void): () => void {
  collapseListeners.add(listener)
  return () => {
    collapseListeners.delete(listener)
  }
}

export function readCollapsed(): boolean {
  try {
    return globalThis.localStorage?.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

export function writeCollapsed(value: boolean): void {
  try {
    globalThis.localStorage?.setItem(COLLAPSED_KEY, value ? "1" : "0")
  } catch {}
  collapseListeners.forEach((listener) => listener())
}
