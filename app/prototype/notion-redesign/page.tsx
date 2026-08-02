import { PrototypeHost } from "./prototype-host"

// Prototype UI (wayfinder #171): three variants of the Notion-style login +
// dashboard shell (list + form pages), switchable via
// `?variant=A|B|C&surface=login|liste|formulaire` on the throwaway
// /prototype/notion-redesign route. Throwaway code — verdict in
// PROTOTYPE-NOTES.md; do not promote directly to production.

export default async function PrototypeNotionRedesignPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; surface?: string }>
}) {
  const { variant, surface } = await searchParams
  return <PrototypeHost initialVariant={variant} initialSurface={surface} />
}
