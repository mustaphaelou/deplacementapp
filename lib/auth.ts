import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"

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

        const user = await prisma.utilisateur.findUnique({
          where: { email },
          include: { departement: true },
        })

        if (!user || !user.actif) return null

        const { compare } = await import("bcryptjs")
        const isValid = await compare(password, user.motDePasse)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          role: user.role,
          departementId: user.departementId,
          departement: user.departement.nom,
          poste: user.poste,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
  ],
})

export const GET = handlers.GET
export const POST = handlers.POST
