# ADR 0021: The environment-configured Administrateur — ADMIN_EMAILS admission and re-assertion, the fifth Role

**Date:** 2026-09-13

**Status:** Accepted

## Context

The Google gate is a deliberately closed pool: an unknown address is refused before any account is created or linked — Google sign-in never provisions accounts — and a returning sign-in must land on an existing, active, Google-enabled Utilisateur. Inside the pool, administration is organisational: FINANCE_ADMIN and GENERAL_DIRECTION manage Utilisateurs, and the Société and Véhicules surfaces sit with FINANCE_ADMIN. A deployment operator (the person who runs the instance) with no such account — or whose account was disabled, never had Google enabled, or lost its role — has no guaranteed way into the instance as its administrator, and in-app state can lock an operator out with no appeal path.

The operator asked for an e-mail address configured as an environment variable that can always sign in as the administrator of the deployment.

## Decision

**`ADMIN_EMAILS` designates the deployment's Administrateur(s): a listed address is provisioned on its first ConnexionGoogle, and its administrator standing is re-asserted at every sign-in — the one deliberate exception to the closed pool. « Administrateur » becomes the fifth Role (code `ADMIN`): full administration of the application — Utilisateurs, Société, Véhicules, Rapports (with exports) — and visibility of every DemandeDeplacement, but never an actor in the validation pipeline.**

### What this means in practice

- **The fifth Role.** `ADMIN` joins the Role vocabulary — enum, TypeScript union, labels, navigation, guards. An Administrateur manages the application's administrative surfaces and sees every DemandeDeplacement; it is never permitted to act at an Etape: `submit`, `retirer`, `approuver` and `rejeter` remain with the four organisational Roles.
- **The variable.** `ADMIN_EMAILS` is a comma-separated list of e-mail addresses, trimmed and matched case-insensitively. Unset or empty means the feature is off — the deployment behaves exactly as today. It is deployment configuration (Coolify / compose / `.env`), documented in `.env.example`.
- **Admission.** On Google sign-in with a listed address: no Utilisateur matches it yet → one is provisioned — attested e-mail, active, Google-enabled, Role ADMIN — the closed pool's single provisioning exception; a Utilisateur matches → sign-in proceeds.
- **Re-assertion.** Every sign-in of a listed address re-asserts the standing — active, Google-enabled, Role ADMIN (a Utilisateur carries exactly one Role, so an account converted from an organisational Role loses it). In-app state can never lock the deployment's administrator out. Every env-enforced change — activation, enablement, role, provisioning — is written to JournalAudit.
- **Grant and revoke in-app.** Additional Administrateurs are granted — and removed — only by an existing Administrateur; FINANCE_ADMIN and GENERAL_DIRECTION keep managing the four organisational Roles, and the administrateur tier is out of their reach. Removing an address from `ADMIN_EMAILS` stops the guarantee; it is not itself a revocation — revoking is demoting or disabling the account in Utilisateurs.
- **Provisioned profile.** Best-effort split of the Google display name into prénom / nom; Poste « Administrateur »; joins the deployment's earliest Département. All of it is editable afterwards like any Utilisateur's.
- **Sign-in method.** Google alone — the Administrateur carries no password.

### What this does not mean

- **Not opening the closed pool.** Every address outside `ADMIN_EMAILS` keeps today's behaviour: unknown addresses stay refused (`utilisateur_introuvable`), returning ones still need active + Google-enabled, refusals keep their French messages and leave no session behind.
- **Not a pipeline seat.** Administrateur never approves, rejects, submits or withdraws; the stage↔Role pairing is untouched; queue and notification semantics are unchanged.
- **Not a self-service role.** No UI path grants `ADMIN` except an existing Administrateur, and no organisational Role's powers change.
- **Not password-based recovery** for the Administrateur — there is no password to reset; Google is the door.
- **Not a replacement for Amorçage** — the setup wizard still creates the first Société, Départements and Utilisateur; until a Société exists there is nothing to sign in to.

## Rationale

- **The operator's key must survive in-app state.** The failure this decision prevents is the operator locked out by a checkbox — precisely the case where config-level authority is needed. Re-assertion makes the environment authoritative at every sign-in, not just the first.
- **One exception, closed door otherwise.** Provisioning exists only for explicitly listed addresses and reuses the existing shapes — attested e-mail, case-insensitive matching, service provisioning. The blast radius is one list the deployment operator controls.
- **Configuration is the right home.** « Who administers this instance » is a deployment decision on a self-hosted, single-Société application; an in-app mechanism would be tamperable by the very state it must outrank.
- **A Role, not a new axis.** Modelling the administrator as the fifth Role keeps one permission vocabulary across guards, navigation and the Utilisateurs screen; a boolean flag or a parallel admin surface would add an axis every future surface must remember.

## Consequences

- The Role vocabulary widens to five: enum value, TypeScript union, labels, navigation, guards (Utilisateurs, Société, Véhicules, Rapports / export), and the Utilisateurs screen's role picker plus who-can-grant rules.
- The Google gate gains the admission and re-assertion path; provisioning reuses the attested-email and service-create shapes; env-enforced writes are JournalAudited.
- `.env.example`, compose / Coolify configuration and the README pick up `ADMIN_EMAILS` and the fifth Role; CI stays absent-safe (unset = off; the variable is optional everywhere).
- Tests to pin: provision-and-sign-in for a listed address (the OAuth callback probe path), re-assertion from disabled / not-enabled / role-changed states, unlisted addresses unchanged (refusals intact), env-absent safety.
- CONTEXT.md records the fifth Role, the `Administrateur` term and the ConnexionGoogle exception.
