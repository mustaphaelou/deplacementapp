# ADR 0020: One demande read model — « pending » defined once

**Date:** 2026-09-12

**Status:** Accepted

## Context

The 2026-09-12 architecture review found that the application's read surfaces can only ask about an Etape, never about the Decision — while a decided DemandeDeplacement keeps its Etape (a rejection does not move it; CONTEXT.md). Consequences, all verified on the review's tree: a rejected demande still counts as « En attente » in the manager, finance and direction queues and pills (`lib/dashboard.ts` over `countByEtape` — deleted by this decision — and `findByEtapes`, which filter on `etape` only); the Employé's « Total » covers three of five lanes — FINANCE_REVIEW and DIRECTION_REVIEW rows count in no employee pill (the `workflow.ts` rollup; the `dashboard.ts` pill set); « Soumises » is a residual that includes rejected review rows; a withdrawn draft still counts as a « Brouillon »; the Rapports « Rejetées » card is hardcoded `0` because no count-by-Decision exists (the Rapports page); and the engaged budget sums rejected finance/direction rows (`aggregateBudget` over `committedEtapes` = `[FINAL, DIRECTION_REVIEW, FINANCE_REVIEW]`, no decision filter).

A withdrawn demande can never sit at a review stage — `retirer` is DRAFT-only — so REJECTED is the only review-stage terminal Decision; the withdrawn case belongs on the DRAFT lane, where it currently inflates « Brouillons ».

And nothing was loud enough to catch any of it: no count, queue, pill or tab fixture holds a decided row at a review stage, so the mis-counting passes green. The display side already learned that PENDING means non-terminal (`compactLabelOf`); the SQL side never did.

## Decision

**« Pending » is defined once, beside the Etape/Decision unions, and the demande query module becomes the demande read model that asks it.** `lib/workflow.ts` exports the predicate (PENDING = non-terminal); `lib/demande/queries.ts` grows decision-aware reads — `countDemandes({ etape?, decision?, employeId? })` as the one counting home (replacing `countByEtape`), `findPendingByEtapes(…)` for the queue reads, a `decision?` filter on the list's query params, and an engaged budget that no longer counts rejected review rows. Every read surface consumes the read model: the queues and pills ask for PENDING rows, « Brouillons » means DRAFT × PENDING, « Soumises » means in-flight PENDING, the employee « Total » covers all five lanes, the « En attente » list tab stops listing rejected rows, and Rapports « Rejetées » is computed from the data.

### What this means in practice

- **One predicate.** `lib/workflow.ts` owns « pending » beside the `Etape`/`Decision` unions and terminal knowledge: PENDING ⟺ non-terminal — `TERMINAL_DECISIONS` + `isPendingDecision`. No surface re-derives *what pending means*: the read model's pending conditions scan `TERMINAL_DECISIONS` (`pendingDecisionCondition` in `lib/demande/queries.ts`), and no call site enumerates or negates the terminal set itself. Surfaces do pass `decision: "PENDING"` as a filter *value* — the dashboard counters, the « En attente » links (`viewAllHref`, the list tab URL) — which is value-passing, not re-derivation.
- **The read model.** `countDemandes({ etape?, decision?, employeId? })` (`CountDemandesParams`) replaces `countByEtape` (deleted — one counting home); `findPendingByEtapes(…)` serves the queue reads (`fetchQueueDemandes`); `DemandeQueryParams` gains `decision?`, threaded through `GET /api/demandes` as an additive optional query param (responses unchanged; an unknown value takes the existing 400 path); the engaged budget keeps FINAL rows as they are and counts review-lane rows only while PENDING.
- **Surface contracts.** Dashboard: queue « En attente » pill + table ask PENDING; « Brouillons » = DRAFT × PENDING; « Soumises » = review lanes × PENDING; « Total » = all five lanes (all non-deleted employee demandes). Demandes list: the « En attente » tab passes `decision=PENDING` — membership only; rendering, labels and fallbacks unchanged. Rapports: « Rejetées » computed (REJECTED only); « Répartition par étape » stays decision-agnostic; no new « Retirées » card.
- **Fixtures.** The count suites seed what production writes: a REJECTED demande at a review stage and a WITHDRAWN draft.
- **No schema change, no migration, no response-shape change, no UI layout change.**

### What this does not mean

- **Not a change to pipeline semantics.** Transitions, authorization and visibility are untouched; rejection still keeps its Etape.
- **Not a redesign of the dashboard or Rapports.** Only counts and membership shift; layout, styling, labels unchanged.
- **Not a « Retirées » card**, and not a rename of « Soumises »: withdrawal exists only at DRAFT; the label set stays as-is.
- **Not a change to « Répartition par étape »**, which is a stage distribution where decided rows legitimately sit.
- **Not touching notifications, the prototype, or the documents/CSV surfaces** (candidate 2's territory).

## Rationale

- **One definition, many readers.** The bug class was "each reader interprets the lane itself"; a single predicate beside the vocabulary makes disagreement impossible to introduce silently.
- **Decided rows stop masquerading as waiting.** Every queue, pill, tab and stat that means "needs action" now asks for PENDING — rejections and withdrawals leave the waiting counts.
- **The employee's own numbers become complete.** Total covers all five lanes; Brouillons/Soumises mean what their labels say.
- **The test hole was the cover.** Decided-row fixtures in the count suites mean the defect class fails the suite instead of passing on all-pending seeds.
- **Least-change shape.** One additive query param and one predicate; no schema, no response-shape change, no restyle.

## Consequences

- The read model is the single home for lane counts; future surfaces ask it with `{etape?, decision?, employeId?}` rather than composing their own filters.
- A count that includes a decided row where "pending" is meant now fails the suite (decided-row fixtures + pinned corrected counts).
- Future reviews should not re-derive « pending » per surface, recreate `countByEtape`-style single-column counts, or re-hardcode Rapports values.
- The « pending » rule and the read-model ownership are recorded in CONTEXT.md; this ADR is the reference for the decision.
