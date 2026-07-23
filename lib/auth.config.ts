export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }: { auth: { user: unknown } | null; request: { nextUrl: { pathname: string } } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname !== "/login"
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      }
      return true
    },
    async jwt({ token, user }: { token: { role?: string; departementId?: string; departement?: string; poste?: string; avatarUrl?: string | null; name?: string | null; email?: string | null; picture?: string | null; sub?: string }; user?: { role?: string; departementId?: string; departement?: string; poste?: string; avatarUrl?: string | null } }) {
      if (user) {
        token.role = user.role
        token.departementId = user.departementId
        token.departement = user.departement
        token.poste = user.poste
        token.avatarUrl = user.avatarUrl
      }
      return token
    },
    async session({ session, token }: { session: { user?: { id?: string; role?: string; departementId?: string; departement?: string; poste?: string; avatarUrl?: string | null; name?: string | null; email?: string | null; image?: string | null }; expires: string }; token: { sub?: string; role?: string; departementId?: string; departement?: string; poste?: string; avatarUrl?: string | null } }) {
      if (session.user) {
        session.user.id = token.sub
        session.user.role = token.role
        session.user.departementId = token.departementId
        session.user.departement = token.departement
        session.user.poste = token.poste
        session.user.avatarUrl = token.avatarUrl
      }
      return session
    },
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 7 * 24 * 60 * 60,
  },
}
