/**
 * The shared Motif fixture set every DemandeDeplacement surface suite seeds
 * from (#275, generalised in #276).
 *
 * A Motif is stored as a JSON-encoded array of entries: canonical slugs from
 * `MOTIF_LABELS`, plus free-text entries the employee typed for « Autre »
 * (`Autre: <texte>`). The stored shape and the displayed shape therefore
 * differ: the document projection (`toDemandeDocumentView`) maps each slug
 * through `MOTIF_LABELS` and passes an unmapped entry through verbatim.
 *
 * Seeding a stored literal that reads identically before and after mapping
 * (e.g. `'["Mission client"]'`) hides that distinction and lets a surface
 * drift back to stored entries unnoticed. `STORED_MOTIF_JSON` is shaped like
 * what production actually writes, and `MOTIF_LABELS_EXPECTED` is the
 * labelled list every surface is expected to end up showing.
 *
 * This module is dependency-free on purpose: app/ routes, lib/ tests and
 * components import it without pulling in a route, a component or the DB.
 */

/** A canonical Motif slug, as the form stores it. */
export const MOTIF_CANONICAL_SLUG = "mission_client"

/** The free-text entry the form stores for « Autre ». */
export const MOTIF_FREE_TEXT = "Autre: taxi collectif"

/** The French label the canonical slug is displayed as. */
export const MOTIF_CANONICAL_LABEL = "Mission client"

/**
 * The stored `motif` column, exactly as production writes it: a JSON array
 * mixing a canonical slug with a free-text entry.
 */
export const STORED_MOTIF_JSON = `["${MOTIF_CANONICAL_SLUG}","${MOTIF_FREE_TEXT}"]`

/**
 * What the document projection yields for {@link STORED_MOTIF_JSON}: the slug
 * becomes its French label, the free-text entry is preserved verbatim.
 */
export const MOTIF_LABELS_EXPECTED = [MOTIF_CANONICAL_LABEL, MOTIF_FREE_TEXT]
