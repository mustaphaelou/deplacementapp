import { auth } from "@/lib/auth/server"
import { toNextJsHandler } from "better-auth/next-js"
import { withRefusalLog } from "@/lib/auth/refusal-log"

// Every OAuth refusal leaves through here as a redirect carrying
// `?error=<code>`, so this is the one place that sees each code — mapped by
// the app or not — and the server-side half of #247: one log line per refusal.
const handler = toNextJsHandler(auth)

export const GET = withRefusalLog(handler.GET)
export const POST = withRefusalLog(handler.POST)
