import { PrototypeHost } from "./prototype-host"

// Prototype UI: three variants of the login page (ReUI split-screen spec),
// switchable via `?variant=A|B|C` on the throwaway /prototype/login-redesign
// route. Throwaway code — verdict in PROTOTYPE-NOTES.md; do not promote
// directly to production.

export default async function PrototypeLoginRedesignPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>
}) {
  const { variant } = await searchParams
  return <PrototypeHost initialVariant={variant} />
}
