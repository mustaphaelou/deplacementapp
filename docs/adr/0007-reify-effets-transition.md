# ADR 0007: Reify EffetsTransition as a deep internal seam

**Date:** 2026-07-28

**Status:** Accepted

## Context

`CONTEXT.md` names **EffetsTransition** — "the side-effects executed immediately following a committed DemandeDeplacement transition, combining JournalAudit logging and Notification dispatches behind a single internal seam" — but the code contradicted that vocabulary in three ways:

1. `lib/demande-event-bus.ts` (40 lines) literally carried "event bus" in its name, violating CONTEXT's `_Avoid_: Event bus, side-effect bus, notification bus`. It was dead in production — only its own self-test imported it.
2. `buildMessage` and `resolveRecipients` existed in 2–3 parallel copies across `mutations.ts`, `notification-bus.ts`, and `workflow.ts`. The action-to-audit-to-notification mapping was duplicated, making the recipient resolution logic drift between the two code paths.
3. `mutations.ts:writeNotifications` was missing the `utilisateurs.actif = true` recipient filter that `notification-bus.ts:133` already had — a silent bug hidden by tests whose fixtures always set `actif: true`.

Additionally, ADR-0006's follow-up note (tracked as #84) flagged that `createDemande` was not wrapped in `db.transaction`, while `executeTransition` was. Both operations produce JournalAudit and Notification rows; the inconsistency was an accident of when each was written.

ADR-0006 (the collapse of single-adapter seams at the demande DB boundary) explicitly preserves side-effect seams: "Where the other side of the seam is a genuinely swappable implementation (...an email provider), a port interface is appropriate." This ADR is the converse: it builds a real *internal* seam for side-effects, absorbing behaviour that was triplicated and removing a dead class whose name violated CONTEXT vocabulary.

## Decision

**Reify the EffetsTransition internal seam.** Extract the shared side-effect logic into a single deep module (`lib/demande/effets-transition.ts`) that exposes `appliquerEffets(tx, …)`, `buildMessage`, and `resolveRecipients`.

### What this means in practice

- **The seam and its interface.** `appliquerEffets(tx, { audit, notification | null })` — an async function that inserts JournalAudit and Notification rows inside the caller's `db.transaction`. Callers (currently `executeTransition` and `createDemande` in `mutations.ts`) assemble the audit and notification payloads from their `WorkflowResult` and pass them in. `buildMessage` and `resolveRecipients` are exported separately for `notification-bus.ts` to import, eliminating the duplicate copies.

- **The rows-only invariant.** EffetsTransition writes only DB rows (JournalAudit + Notification) inside the caller's transaction. Email dispatch is explicitly out of scope — it belongs to `EmailSender`, fired by the AccuseLecture path inside `NotificationBus.markAsRead`, not by transitions. This is a named invariant of the module, not an accidental current state. It is recorded in `CONTEXT.md`'s EffetsTransition entry.

- **`createDemande` tx wrap (closes #84).** Pre-ADR-0007, `createDemande` was not wrapped in `db.transaction`; `executeTransition` was (per #84 / ADR-0006 follow-up). ADR-0007 lands both at once as the natural unit since `appliquerEffets(tx, …)` is the shared interface. Both call sites now produce their side-effects inside a `db.transaction` callback.

- **`actif = true` behaviour fix (locked by spec Q8).** During the dedupe, the `utilisateurs.actif = true` filter that `notification-bus.ts:133` already had replaced the missing filter in `mutations.ts:writeNotifications` — a silent bug that was hidden by tests whose fixtures always set `actif: true`. A new mixed-`actif` PGLite test in `lib/demande/mutations.test.ts` locks in the fix. The bug fix landed inside a structural candidate because that is where the dedupe surfaced it.

- **Dead-bus deletion (locked by spec Q12).** `lib/demande-event-bus.ts` was dead in production — zero imports outside its own file and its self-test. Its name literally carried "event bus" (a CONTEXT `_Avoid_` word). Deleted alongside its orphaned test file. A one-line historical annotation was added to `docs/research/di-wiring-pattern.md` pointing to this ADR; the rest of the research note is left unchanged (per ADR-0006's retention mandate).

- **New neutral vocabulary module.** `lib/notification-events.ts` owns the shared vocabulary: `NotificationEventType`, `NotificationPayload`, `NotificationMessage`, and `EVENT_ROLE_MAP`. Both `effets-transition.ts` and `notification-bus.ts` import from this single source — drift between transition notifications and AccuseLecture routing is impossible.

### What this does not mean

- **This does not re-open ADR-0006's restriction on re-extracting DB ports.** The demande DB seam (ports, adapters, DI wiring) was collapsed for good reason — this ADR builds a separate *side-effect* internal seam, which ADR-0006 explicitly preserves. The two decisions are complementary: collapse local-substitutable DB seams; reify side-effect seams where behaviour is genuinely shared.

- **This does not modify `audit-bus.ts`.** JournalAudit logging for non-transaction callers (e.g., societe PATCH operations that log `MODIFIER_SOCIETE`) continues to use the existing `auditBus.log` interface. The new `appliquerEffets` covers only the transition path.

- **This does not pre-stage a `lib/notification/` directory.** YAGNI — revisit if Candidate 4 (Notification unification) grows the surface.

- **This does not re-rection `DrizzleNotificationAdapter.send`.** The notification bus adapter keeps its three-concern shape (row insert + recipient lookup + email send). Re-sectioning is Candidate 4's territory.

## Rationale

- **Dedupe eliminates the drift vector.** `buildMessage` and `resolveRecipients` in 2–3 copies meant the recipient resolution logic could diverge — and did (`actif` filter was missing in mutations.ts). A single implementation prevents future drift.

- **The dead bus confused readers.** A file named `demande-event-bus.ts` contradicted CONTEXT vocabulary and suggested the Event Bus pattern was still active. Deleting it removes the confusing signal.

- **Transactionality was inconsistent.** `createDemande` (used by both `createDraft` and `createAndSubmit`) was outside `db.transaction`, meaning a partial write could leave the system with a stale JournalAudit entry but no DemandeDeplacement row. Wrapping it in the same transaction pattern as `executeTransition` closes #84.

- **The rows-only invariant is load-bearing for Candidate 2.** The EmailSender spec (Candidate 2, spec #92) depends on the fact that transitions do not fire email — only the AccuseLecture path does, via EmailSender. Recording this as a named invariant in the EffetsTransition module and in CONTEXT.md prevents future confusion.

- **PGLite tests cross the public seam, not the internal one.** No `lib/demande/effets-transition.test.ts` exists — tests exercise `executeTransition` and `createDemande` in the existing `mutations.test.ts` (the same seam callers use). The one new fixture with mixed `actif` values locks in the bug fix without adding a separate test file for the internal interface.

## Consequences

- `buildMessage` and `resolveRecipients` each exist exactly once — in `lib/demande/effets-transition.ts`. The notification bus imports them from there.
- `notification-bus.ts` is a thin consumer: it imports vocabulary from `lib/notification-events.ts` and helpers from `lib/demande/effets-transition.ts`.
- All transition side-effects (audit + notification) run inside `db.transaction` — atomicity is guaranteed for both `createDemande` and `executeTransition`.
- Recipients with `actif = false` no longer receive transition notifications — the bug is fixed and locked by a mixed-`actif` test.
- Future architecture reviews should not suggest re-extracting the EffetsTransition seam — its rationale is recorded here and is the converse of ADR-0006.
