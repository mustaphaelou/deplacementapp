export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }: { auth: any; request: { nextUrl: any } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname !== "/login"
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      }
      return true
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role
        token.departementId = user.departementId
        token.departement = user.departement
        token.poste = user.poste
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.sub
        session.user.role = token.role
        session.user.departementId = token.departementId
        session.user.departement = token.departement
        session.user.poste = token.poste
      }
      return session
    },
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 7 * 24 * 60 * 60,
  },
}
