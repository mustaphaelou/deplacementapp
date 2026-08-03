"use client"

import { createAuthClient } from "better-auth/react"
import type { BetterAuthSessionUser } from "./user-mapper"
import { toAuthUser } from "./user-mapper"
import type { AuthUser } from "./user-mapper"

/**
 * The client half of the auth seam (`lib/auth/client.ts`).  Mirrors the
 * `AuthUser` shape of the server seam (`lib/auth/server.ts`) so no library
 * shape leaks into client components: `useAuthUser()` reads the session,
 * `signInWithCredentials` / `signInWithGoogle` sign in, and `signOut`
 * revokes the session and redirects.
 */
export const authClient = createAuthClient()

export function useAuthUser(): {
  user: AuthUser | null
  isPending: boolean
  refetch: () => void
} {
  const { data: session, isPending, refetch } = authClient.useSession()
  const user = session?.user
    ? toAuthUser(session.user as BetterAuthSessionUser)
    : null
  return { user, isPending, refetch }
}

export async function signInWithCredentials(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export async function signInWithGoogle() {
  await authClient.signIn.social({ provider: "google", callbackURL: "/" })
}

export async function signOut(redirectTo = "/login") {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.assign(redirectTo)
      },
    },
  })
}
