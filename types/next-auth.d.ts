import "next-auth"

declare module "next-auth" {
  interface User {
    role?: string
    departementId?: string
    departement?: string
    poste?: string
    avatarUrl?: string | null
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      departementId: string
      departement: string
      poste: string
      avatarUrl: string | null
    }
  }
}

export {}
