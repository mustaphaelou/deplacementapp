"use client"

import { createContext, useContext, useCallback, useRef, type ReactNode } from "react"

type NotificationContextValue = {
  refreshBell: () => void
  onRefresh: (cb: () => void) => () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef<Set<() => void>>(new Set())

  const refreshBell = useCallback(() => {
    listenersRef.current.forEach((cb) => cb())
  }, [])

  const onRefresh = useCallback((cb: () => void) => {
    listenersRef.current.add(cb)
    return () => {
      listenersRef.current.delete(cb)
    }
  }, [])

  return (
    <NotificationContext.Provider value={{ refreshBell, onRefresh }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotificationContext must be used within NotificationProvider")
  return ctx
}
