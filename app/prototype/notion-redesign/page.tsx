import { PrototypeHost } from "./prototype-host"

// Prototype UI (wayfinder #171): the approved Variant A of the Notion-style
// login + dashboard shell (list + form pages), switchable via
// `?surface=login|liste|formulaire` on the throwaway /prototype/notion-redesign
// route. Throwaway code — verdict in PROTOTYPE-NOTES.md; do not promote
// directly to production.

export default async function PrototypeNotionRedesignPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>
}) {
  const { surface } = await searchParams
  return <PrototypeHost initialSurface={surface} />
}
