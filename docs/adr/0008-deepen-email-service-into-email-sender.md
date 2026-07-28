# ADR 0008: Deepen EmailService into EmailSender with a real transport seam

**Date:** 2026-07-28

**Status:** Accepted

## Context

The application sends outgoing notification emails — primarily AccuseLecture (read-receipt) messages fired when an Employee marks a demande-related Notification as read. This responsibility lived in a single 80-line module (`EmailService`) with three problems:

1. **No real seam.** The module read `SMTP_*` env vars synchronously in its constructor and instantiated `nodemailer.createTransport` directly. Tests could not substitute the transport without a running SMTP server — and the SMTP-missing case (`transporter = null`) silently returned `{ success: true }`, masking any bug it would catch.
2. **Empty error handling.** Every `send()` wrapped a one-row Societe lookup in `try { ... } catch {}` with an empty catch. The Societe read duplicated a one-row lookup already performed by `getSocieteBranding` for the login-page branding; if the DB was down, both code paths stayed silent and the email went out with env-fallback sender identity. The intent (resilient degradation) was fine; the silence was not.
3. **`NomExpediteurEmail` never persisted at Amorçage.** The setup wizard stored `DomaineEmail` but not `NomExpediteurEmail`, even though the column existed. Outgoing mail started on the env-var fallback until an admin PATCHed the Societe manually — a gap invisible because of (2).

CONTEXT.md already named `EmailSender` (in the EffetsTransition row, "email belongs to the EmailSender module, fired by AccuseLecture, not by transitions") but defined it nowhere — `EmailService` was the existing-but-unnamed predecessor.

Under ADR-0007's rows-only invariant (Candidate 1), `EmailSender` has exactly one production caller — the AccuseLecture path dispatched from `markAsRead` in the notification bus. That single-caller property gives the seam its narrow interface.

## Decision

**Deepen the existing concrete module into a single deep module named `EmailSender`**, owning two concerns behind one narrow interface: (a) an injected `EmailTransporter` adapter (SMTP for prod, `NullTransporter` for SMTP-missing — both production adapters), and (b) Societe identity (`NomExpediteurEmail` + `DomaineEmail`, env-fallback) resolved once per process and memoized.

### What this means in practice

- **The transport seam is preserved** as the kind of side-effect seam ADR-0006 explicitly carves out at lines 31–32: "Where the other side of the seam is a genuinely swappable implementation (...an email provider), a port interface is appropriate" and "constructor injection with a default remains the right pattern" for "email dispatch". `EmailTransporter` is declared alongside `EmailSender` (consumer-driven seam, mirroring `NotificationAdapter` next to `NotificationBus` in the notification-bus module). One method: `sendMail({ from, to, subject, text, html? })`. `from` is supplied by the caller (`EmailSender`), resolved internally from Societe identity + env fallback.

- **Two-production-adapter lift (SmtpTransporter + NullTransporter):** `SmtpTransporter` wraps `nodemailer.createTransport`, reading `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in its own constructor — env-reading moves out of the singleton-wiring site and into the adapter where its lifecycle is local to itself. `NullTransporter` is the SMTP-not-configured case, lifted to a named production adapter: `sendMail` warns on the first call (warn-once per instance), then swallows silently, resolving with `undefined`. Two real production adapters satisfy ADR-0006's "two adapters means a real seam" rule. The SMTP-missing case is a named strategy with a warn-once hook rather than a null transporter check inside `send()`.

- **Societe identity collapse applies ADR-0006's single-adapter-collapse mandate** at a local-substitutable boundary: the far side is Drizzle (already testable via PGLite per ADR-0006), so the read lives behind a plain memoized function (`loadSocieteIdentity`) rather than a reified `SocieteIdentity` interface. No fake adapter — tests route through PGLite seeding. The resolver always returns `SocieteIdentity` (env values when the DB is unreachable or the row is missing). First failure logs `console.warn` once per process; subsequent calls return the cached env identity (no log spam). Exposes a `clearCache()` hook for test isolation.

- **Warn-once-and-succeed contract:** Silent-success when SMTP is missing (intentional defensive design — the AccuseLecture path stays available in degraded configurations), but with a named warn on first occurrence so the silence is observable. Replaces today's empty `try { ... } catch {}` in `EmailService.send` and the empty `catch {}` in `getSocieteBranding`.

- **Amorçage persistence gap deferral (F1):** `NomExpediteurEmail` is never written at setup (`app/api/setup/register/route.ts`), even though the column exists. `loadSocieteIdentity`'s env-fallback tolerates the null column. Candidate 3 (Societe / Amorçage management) owns the setup-form + register-route fix. This ADR notes the coupling.

- **Reference to ADR-0007 (Candidate 1's rows-only invariant):** `EmailSender`'s single-caller property depends on Candidate 1's invariant that transition-triggered notifications produce rows only — email is the AccuseLecture path's responsibility, fired when an Employee marks a Notification as read.

- **The "real seam" / "collapsed seam" split:** This candidate applies both halves of ADR-0006 at once — preserve the external side-effect seam (transport) while collapsing the local-substitutable seam (Societe identity). Future reviewers should consult ADR-0006 and this ADR together before re-evaluating either side.

### What this does not mean

- **This does not relocate email content (HTML template) into EmailSender.** Email content and recipient lookup stay in `DrizzleNotificationAdapter.send` — those are Candidate 4's territory. Candidate 2 deliberately stays narrow.

- **This does not add `from?:` to `EmailSender.send`'s interface.** Widen only if a real second caller needs per-message sender variation (K1 — YAGNI).

- **This does not pre-stage a `lib/email/` subdirectory.** YAGNI — revisit if Candidate 4 grows the email surface.

- **This does not fix the Amorçage persistence gap.** Candidate 3 owns that fix.

- **This does not re-open ADR-0006's restriction on re-extracting DB ports or ADR-0007's rows-only invariant.** The transport seam and the collapsed Societe identity are within the scope of those ADRs; this ADR applies both rules without relitigating them.

## Rationale

- **The old EmailService had no test seam.** A test author wanting to verify the email-sending path needed a running SMTP server or had to mock at the nodemailer level. The `EmailTransporter` interface provides a clear seam at the right level — tests substitute a recording fake.

- **SMTP-missing is a production concern, not a test concern.** Naming it `NullTransporter` (a second production adapter) gives the SMTP-not-configured case an explicit identity, a single location for its warn hook, and satisfies ADR-0006's two-adapter requirement.

- **The Societe identity read was duplicated and silently failing.** Two sites (`EmailService.send` and `getSocieteBranding`) performed the same `db.select().from(societes).limit(1)` query, both with empty `catch {}` blocks. Consolidating behind a memoized function with a warn-once hook eliminates the duplicate query and surfaces the failure.

- **The memoized resolver + env-fallback provides resilience.** When the DB is unreachable, the AccuseLecture email path continues to work with env-var defaults. The warn-once pattern prevents log spam while still making the configuration gap observable.

- **The rows-only invariant (ADR-0007) keeps EmailSender's scope narrow.** Because transitions do not fire email (only AccuseLecture does), `EmailSender` has exactly one caller and a correspondingly narrow interface. This would not be the case if transitions also sent email — the interface would need to grow a `from?` parameter or content-composition methods.

## Consequences

- The `EmailTransporter` seam has two production adapters (`SmtpTransporter`, `NullTransporter`) and a third test adapter (recording fake). Adding a Mailgun/SES/Postmark adapter touches one file plus the wiring site.
- `EmailSender.send` returns `{ success, error? }` — errors from the transport or identity-resolution path are surfaced to the caller, not silently swallowed.
- The notification bus's only change is the import line `emailService` → `emailSender`. The `DrizzleNotificationAdapter.send` method's three-concern shape (row insert + recipient lookup + email send) is unchanged.
- The Amorçage persistence gap (`NomExpediteurEmail` never written at setup) remains unaddressed — `loadSocieteIdentity`'s env-fallback tolerates it, but the Societe must be PATCHed manually to use the configured sender name.
- Future architecture reviews should not suggest re-extracting the `SocieteIdentity` seam or re-collapsing the `EmailTransporter` seam — the rationale is recorded here.
