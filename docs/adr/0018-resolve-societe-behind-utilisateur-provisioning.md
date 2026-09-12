# ADR 0018: Resolve the deployment's Societe behind the Utilisateur provisioning seam

**Date:** 2026-09-12

**Status:** Accepted

## Context

The 2026-09-12 architecture review found that the Utilisateur intake interface demanded a `societeId` that no caller can supply. The administration surface's provisioning and edit requests validate against `utilisateurSchema`, which requires the field, while the surface's form state carries no such value — so both the POST (create) and the PUT (edit) answer 400, the validator listing « Société requise ». The break was invisible: the route suite injected `societeId` into its fixtures, and the page suite only static-renders.

Meanwhile: the deployment has exactly one Societe (CONTEXT.md), the service's `update` interface never accepted the field (only the schema demanded it), and the Societe module already owns the deployment's raw single-row read — `getSocieteRow`, added by ADR-0012 for the management surface.

## Decision

**Provisioning resolves the deployment's Societe behind the seam.** The intake schema drops the mandatory `societeId`; `UtilisateurService.create` takes Utilisateur facts only and resolves the single Societe itself, through the Societe module's existing single-row read, inside its own transaction. When no Societe row exists — unreachable after Amorçage — it refuses with the plain-Error contract the Societe writer already uses.

### What this means in practice

- **Intake schema.** `utilisateurSchema` loses only `societeId`; its extension for updates inherits the fix, so the administration surface's real payloads are accepted on both POST and PUT. Every other field keeps its current optionality. No migration — the column and its data are untouched.
- **Service.** `create(data, actorId)` drops the `societeId` parameter; inside `db.transaction` it reads the deployment's Societe row and writes its id on the insert. Credential and JournalAudit writes are unchanged.
- **Missing-Societe refusal.** `Error("Aucune société configurée")` — the same impossible-state contract as `updateSociete`, already pinned by the Societe suite.
- **Page-side guard.** The admin page's submit-body construction is extracted into a small pure function, unit-tested against `utilisateurSchema`: the exact payload the form produces must pass the guard that protects the route. The route suite exercises the real payload shape (no injected Société id); the service suite asserts the created row carries the deployment's Societe id.

### What this does not mean

- **Not a redesign of the update schema** (partial-update) — a separate concern.
- **Not a change to the update route's runtime behaviour** beyond the schema fix; unknown keys are stripped by validation as elsewhere.
- **Not gating `/api/departements`** — separate candidate from the same review.
- **Not narrowing `AuthUser.role` to `Role`** — separate candidate.
- **Not adding browser-test infrastructure** — the payload-builder unit test carries the guard; RTL/jsdom remain out.
- **Does not re-litigate ADR-0012** — `getSocieteRow` stays the raw-row reader; its docstring widens to name provisioning as a consumer. Nor ADR-0009 — Amorçage is untouched.

## Rationale

- **Depth.** A caller-unknowable fact (which Societe) moves behind the seam; the interface shrinks and the invalid call becomes unrepresentable.
- **Repair.** The only provisioning surface was fully blocked for create and edit — a live defect, not only an architectural wart.
- **Consistency.** `loadSocieteIdentity` and `getSocieteRow` already read the deployment's single Societe; provisioning now follows the same shape instead of exporting the fact to callers.
- **The test seam was the hole.** The suites now exercise the real payload shapes at every seam: the wire contract (route), the write (service), the schema, and the form↔schema pin.

## Consequences

- Administrators can create and edit Utilisateurs again.
- The suite would now catch this defect class: a payload without `societeId` is accepted; a created Utilisateur is asserted to carry the deployment's Societe id.
- Future reviews should not re-add `societeId` to the intake schema, and future callers should not pass it — the resolution is the module's business.

## Tickets

Three tracer-bullet tickets are filed alongside this ADR via the `/to-tickets` skill: the contract repair (intake schema, service resolution, suites), the payload guard (the admin page's submit payload pinned against the schema), and this ADR's documentation pass. The payload guard and the documentation pass are both blocked by the contract repair.
