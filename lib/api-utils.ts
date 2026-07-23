import { z } from "zod"
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import type { AuthUser } from "@/lib/auth-utils"

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

export function validateRequest<T>(
  schema: z.ZodType<T>,
  body: unknown
): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Données invalides", details: result.error.issues.map((e) => e.message) },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: result.data }
}

export function validateQueryParams<T>(
  schema: z.ZodType<T>,
  req: NextRequest
): ValidationResult<T> {
  const { searchParams } = new URL(req.url)
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Paramètres invalides", details: result.error.issues.map((e) => e.message) },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: result.data }
}

export function withValidation<T, P = unknown>(
  schema: z.ZodType<T>,
  handler: (req: NextRequest, auth: AuthUser, data: T, params: P) => Promise<NextResponse>
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse> {
  return async (req, { params }) => {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(schema, body)
    if (!validation.ok) return validation.response

    return handler(req, auth.user, validation.data, await params)
  }
}
