import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/setup|_next/static|_next/image|favicon.ico|login|prototype).*)",
  ],
}
