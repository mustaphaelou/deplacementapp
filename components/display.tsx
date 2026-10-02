import { Label } from "@/components/ui/label"

/**
 * The dashboard's repeated display geometry, owned once.
 *
 * Every string below was copied, page by page, from the copy before it — which
 * is why they agree today and why changing one is an edit per copy. They live
 * here so the next change to the field, the table rule, or the row tint is one
 * edit instead of five.
 *
 * The interface is the test surface: `components/display.test.tsx` pins each
 * constant's exact string, each module's rendered markup, and the
 * responsive-hide rule at every breakpoint it supports. A page test asserts
 * only that the page reaches this module — it must not re-assert these strings,
 * because that is the duplication this module exists to remove.
 *
 * A green pin here proves a class STRING is present, never how it looks. The
 * render suite runs in a `node` environment with no CSS engine, so visual
 * confirmation stays the manual light-and-dark eyeball.
 *
 * #306 creates this module and moves no call site; #307 migrates the pages and
 * the dashboard layout onto it; #308 lowers the drift gate's ratchet to what
 * remains. The copy left in `app/(auth)/login/**` and `app/prototype/**` is
 * out of both tickets' scope and is left where it is.
 */

/**
 * The field text style the dashboard's forms layer over the shadcn `Input`.
 *
 * This is the repeated one — declared under the same name in five files
 * (`demande-form`, `profile-edit`, and the Societe, Véhicules and Utilisateurs
 * pages). It is a LAYER, not a whole field: the `Input` primitive already
 * supplies the box, the border and the font, and `cn` merges this run on top.
 *
 * Two other full-field runs exist and are deliberately NOT this constant:
 * `demande-form.tsx` styles a bare `<select>` with the same geometry inline
 * (nothing merges it there, so it must spell the whole field out), and the
 * Societe page's colour swatch is a `size-9` square button beside an input,
 * not a field. The city combobox trigger is a base-ui primitive carrying its
 * own `py-1.5` padding. Three different components, three one-off strings;
 * folding them into one "text input" would be a merge, not an extraction.
 */
export const textInputClass =
  "h-9 rounded-[3px] focus-visible:ring-1 focus-visible:ring-(--brand)"

/**
 * The ink tint a list row hovers with — the faintest of the two, used for the
 * row itself.
 *
 * The darker `rowActionHover` tint (0.06) is a DIFFERENT decision: it marks the
 * actionable cell inside the row, not the row. The sidebar uses the darker one
 * throughout because its rows have no separate action cell. They are two
 * constants that happen to share a shape, and merging them would silently
 * double the row's hover weight.
 */
export const rowHoverInkTint =
  "hover:bg-[rgba(55,53,47,0.024)] dark:hover:bg-sidebar-accent/40"

/**
 * The table's shell: hairline rules top and bottom, no left/right border, and
 * horizontal scroll rather than a wrapped cell.
 */
export const tableShellClass = "overflow-x-auto border-y border-border text-sm"

/**
 * The search field's magnifier overlay, absolutely placed against the
 * `relative` wrapper.
 *
 * Byte-identical at the three sites. The field it overlays is NOT the same
 * string at all three: the two administration tables ask for
 * `searchFieldInputClass` below, while the Demandes list asks for a bare
 * `w-60 pl-8` because it has already got a sibling tab row setting the height.
 * The overlay is the part that is genuinely shared.
 */
export const searchFieldIconClass =
  "absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"

/** The search field's own geometry, at the two administration tables. */
export const searchFieldInputClass = "h-8 w-60 pl-8"

/** The centred loading block's box. */
export const loadingBlockClass = "flex items-center justify-center p-8"

/** The centred loading block's text. */
export const loadingTextClass = "text-sm text-muted-foreground"

/**
 * The field label's text style, layered over the shadcn `Label`.
 *
 * The brief for this work guessed `text-xs font-medium text-muted-foreground`
 * for this constant; the measured string is this one. That guess actually
 * matches the avatar's initials and the date picker's own headings, which are
 * different components at a different size.
 */
export const fieldLabelClass = "mb-1.5 block text-sm font-medium"

/**
 * The section heading: a small uppercase run followed by a hairline that fills
 * the rest of the row.
 *
 * Three of the four sites carry these tokens in this order. The Societe page
 * carries the SAME tokens with `uppercase` last. Class-token order is not
 * behaviour, so normalising it here is a no-op that removes the drift by
 * accident rather than a change a Utilisateur could see. No other difference
 * is authorised: the sidebar's and the login page's `tracking-[0.06em]` are
 * 11px labels on different components and stay where they are.
 */
export const sectionHeadingClass =
  "text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"

/** The section heading's trailing rule. */
export const sectionHeadingRuleClass = "h-px flex-1 bg-border"

/** The section heading's row. */
export const sectionHeadingRowClass = "flex items-center gap-3"

/** The property row's label, above the value. */
export const propertyLabelClass = "text-xs text-muted-foreground"

/** The property row's value, under the label. */
export const propertyValueClass = "mt-0.5 text-sm font-medium"

/** The labelled field's optional hint, under the control. */
export const fieldHintClass = "mt-1.5 text-xs text-muted-foreground"

/** Breakpoints a table cell can be hidden below and reappear at. */
export type HideBreakpoint = "sm" | "md" | "lg"

/**
 * A cell hidden below one breakpoint reappears at the next one.
 *
 * A caller that hides a cell no longer states the reappearance, because there
 * is nothing left to state. Sixteen call sites wrote the pair out longhand —
 * eight `th`/`td` pairs each in the Utilisateurs, Demandes and Véhicules
 * tables, on the list pages that render their own `<table>` markup and so never
 * pass a column descriptor at all. The dashboard layout module carried a
 * duplicate of this function for its config-driven widget table; #307 deleted
 * it, so this is the only definition left in the tree.
 *
 * `undefined` when no breakpoint is given: an always-visible cell carries no
 * class at all, and `cn` drops an `undefined` argument, so a caller can pass
 * this straight through without branching.
 */
export function hideClassFor(col: { hideAt?: HideBreakpoint }) {
  if (!col.hideAt) return undefined
  const showAt =
    col.hideAt === "sm"
      ? "sm:table-cell"
      : col.hideAt === "md"
        ? "md:table-cell"
        : "lg:table-cell"
  return `hidden ${showAt}`
}

/**
 * The section heading, uppercase, with its hairline.
 *
 * Byte-identical at the Demande form, the Demande detail, the profile editor
 * and the Societe settings page, modulo the token order normalised above.
 */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className={sectionHeadingRowClass}>
      <h2 className={sectionHeadingClass}>{children}</h2>
      <span className={sectionHeadingRuleClass} />
    </div>
  )
}

/**
 * The labelled field: a label, the control, and an optional hint.
 *
 * The hint is a SLOT with a default of no hint, not a second shape. Three of
 * the four sites pass no hint and render no hint paragraph at all; the Societe
 * page fills the same slot twice. A variant here would have meant the
 * no-hint case and the hint case diverging the first time either was edited.
 */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className={fieldLabelClass}>
        {label}
      </Label>
      {children}
      {hint && <p className={fieldHintClass}>{hint}</p>}
    </div>
  )
}

/**
 * The label-and-value property row: the label above, the value under it.
 *
 * Two sites — the Demande detail and the profile editor — and the two bodies
 * are byte-identical. Two is thin, and it is kept because the alternative is a
 * permanent odd-one-out.
 */
export function PropertyRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={propertyLabelClass}>{label}</p>
      <p className={propertyValueClass}>{children}</p>
    </div>
  )
}

/**
 * The centred loading block: a box and the word.
 *
 * Four sites, byte-identical. The Societe page's spinner is a DIFFERENT block —
 * `p-12` and a `Loader2` glyph instead of the word — and is not folded in: it
 * is a one-off, and merging it would either change that page's padding or
 * leave this module carrying a switch nobody asked for.
 */
export function LoadingBlock() {
  return (
    <div className={loadingBlockClass}>
      <p className={loadingTextClass}>Chargement...</p>
    </div>
  )
}
