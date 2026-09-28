// The Motif fixture shared by every surface suite that serialises a
// DemandeDeplacement: the detail page, the printable form and (from #276) the
// PDF.
//
// The point of the fixture is that it is PRODUCTION-SHAPED. What the creation
// form writes is a JSON list of slug-space values, with the « Autre » option
// replaced in place by the employee's free text (lib/demande/mutations.ts,
// processMotif). A suite that seeds `["Réunion client"]` — a stored literal
// that reads identically whether or not it went through MOTIF_LABELS — cannot
// see a surface that forgot to label its Motifs, because both the labelled and
// the unlabelled renderings agree. Seeding a canonical slug plus a free-text
// entry is what makes the defect class observable: the slug MUST come out as
// its French label, the free text MUST survive verbatim.
//
// Dependency-free on purpose — no component, no route, no presentation import —
// so any of the three suites can pull it in without dragging a surface along.

/** The canonical slug as it is STORED: slug space, never a label. */
export const MOTIF_SLUG = "mission_client"

/** The French label that slug must be presented as. */
export const LIBELLE_MOTIF_SLUG = "Mission client"

/**
 * The « Autre » entry after processMotif: the employee typed it, it is not in
 * MOTIF_LABELS, and it must be presented verbatim — never prettified, never
 * blank.
 */
export const MOTIF_LIBRE = "Autre: taxi collectif"

/** The whole stored column value, exactly as the writer would persist it. */
export const MOTIF_STOCKE = JSON.stringify([MOTIF_SLUG, MOTIF_LIBRE])

/** What a correctly projecting surface renders, in order, before joining. */
export const MOTIFS_AFFICHES = [LIBELLE_MOTIF_SLUG, MOTIF_LIBRE]

/** The joined form the surfaces put in the « Motif(s) » cell. */
export const MOTIFS_AFFICHES_TEXTE = MOTIFS_AFFICHES.join(", ")
