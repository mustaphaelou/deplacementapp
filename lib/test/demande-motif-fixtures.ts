/**
 * The shared Motif fixture set every DemandeDeplacement surface suite seeds
 * from (#273, #274, #275, unified in #276).
 *
 * The point of the fixture is that it is PRODUCTION-SHAPED. What the creation
 * form writes is a JSON list of slug-space values, with the « Autre » option
 * replaced in place by the employee's free text (lib/demande/mutations.ts,
 * processMotif). A suite that seeds `["Réunion client"]` — a stored literal
 * that reads identically whether or not it went through MOTIF_LABELS — cannot
 * see a surface that forgot to label its Motifs, because the labelled and the
 * unlabelled renderings agree. Seeding a canonical slug plus a free-text entry
 * is what makes the defect class observable: the slug MUST come out as its
 * French label, the free text MUST survive verbatim.
 *
 * ONE fixture, THREE surface suites: the detail page, the printable form and
 * the PDF render data. A surface that stops going through the projection fails
 * the same assertion everywhere, from one source.
 *
 * Dependency-free on purpose — no component, no route, no presentation import —
 * so app/ routes, lib/ tests and components can all pull it in without
 * dragging a surface along.
 */

/** A canonical Motif slug, as the form stores it: slug space, never a label. */
export const MOTIF_CANONICAL_SLUG = "mission_client"

/** The French label that slug must be presented as. */
export const MOTIF_CANONICAL_LABEL = "Mission client"

/**
 * The « Autre » entry after processMotif: the employee typed it, it is not in
 * MOTIF_LABELS, and it must be presented verbatim — never prettified, never
 * blank. This is the case the projection's fallback rule exists for.
 */
export const MOTIF_FREE_TEXT = "Autre: taxi collectif"

/** The stored `motif` column, exactly as production persists it. */
export const STORED_MOTIF_JSON = `["${MOTIF_CANONICAL_SLUG}","${MOTIF_FREE_TEXT}"]`

/**
 * What the document projection yields for {@link STORED_MOTIF_JSON}: the slug
 * becomes its French label, the free-text entry is preserved verbatim.
 */
export const MOTIF_LABELS_EXPECTED = [MOTIF_CANONICAL_LABEL, MOTIF_FREE_TEXT]

/** The joined form the surfaces put in the « Motif(s) » cell. */
export const MOTIF_LABELS_EXPECTED_TEXT = MOTIF_LABELS_EXPECTED.join(", ")
