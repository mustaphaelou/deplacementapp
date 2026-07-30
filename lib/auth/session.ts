import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { utilisateurs } from "../../db/schema/utilisateurs"
import { authConfig } from "./config"
import type { Role } from "./roles"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  departementId: string
  departement: string
  poste: string
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse }

export type AuthorizationResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        const [user] = await db
          .select()
          .from(utilisateurs)
          .where(eq(utilisateurs.email, email))
          .limit(1)

        if (!user || !user.actif) return null
        if (!user.motDePasse) return null

        const { compare } = await import("bcryptjs")
        const isValid = await compare(password, user.motDePasse)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          role: user.role,
          departementId: user.departementId,
          departement: "",
          poste: user.poste,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
    Google,
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const dbUser = await db.query.utilisateurs.findFirst({
          where: eq(utilisateurs.email, user.email!),
        })
        if (!dbUser || !dbUser.actif || !dbUser.googleAuthEnabled) return false
        user.id = dbUser.id
        user.role = dbUser.role
        user.departementId = dbUser.departementId
        user.departement = ""
        user.poste = dbUser.poste
        user.avatarUrl = dbUser.avatarUrl
      }
      return true
    },
  },
})

export const GET = handlers.GET
export const POST = handlers.POST

function getSessionUser(user: { id?: string; email?: string | null; name?: string | null; role?: string; departementId?: string; departement?: string; poste?: string }): AuthUser {
  return {
    id: user.id ?? user.email ?? "",
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role ?? "",
    departementId: user.departementId ?? "",
    departement: user.departement ?? "",
    poste: user.poste ?? "",
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user) return null
  return getSessionUser(session.user)
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
    }
  }
  return { ok: true, user: getSessionUser(session.user) }
}

export function hasAnyRole(role: string, allowed: readonly Role[]): boolean {
  return allowed.includes(role as Role)
}

export function requireRole(user: AuthUser, requiredRole: Role): AuthorizationResult {
  if (!hasAnyRole(user.role, [requiredRole])) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    }
  }
  return { ok: true }
}

export function requireAnyRole(user: AuthUser, requiredRoles: readonly Role[]): AuthorizationResult {
  if (!hasAnyRole(user.role, requiredRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    }
  }
  return { ok: true }
}
