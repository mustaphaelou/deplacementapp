import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

export default NextAuth({
  ...authConfig,
  providers: [],
}).auth

export const config = {
  matcher: ["/((?!api/auth|api/health|api/setup|_next/static|_next/image|favicon.ico|login).*)"],
}
