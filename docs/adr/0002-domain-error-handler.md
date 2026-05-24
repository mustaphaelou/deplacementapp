# ADR 0002: Domain error handler seam

**Date:** 2026-05-24

**Status:** Accepted

## Context

Error classes for domain operations (not found, unauthorized, invalid
transition, etc.) were duplicated across service files
(`lib/demande-service.ts`, `lib/utilisateur-service.ts`,
`lib/vehicule-service.ts`). Each API route manually remapped them via
`instanceof` chains. Adding a new error type required updating every route
that called the affected service.

The error classes already carried a numeric `.status` property, but routes
ignored it and used their own hard-coded status codes.

## Decision

Consolidate all domain error classes into a single module
(`lib/errors.ts`). Provide a single `handleServiceError(e: unknown)`
function that:

- Duck-types on the `.status` property — any object with a numeric
  `.status` is treated as a domain error and its `.message` is returned
  as the response body with that status code.
- Logs unknown errors to the console and returns a generic 500 response.

Backward-compatible re-exports are kept in each original service file so
existing test imports continue to work unchanged.

## Rationale

- **Zero route changes when adding errors** — a new error class is one
  file, one class; no route needs updating.
- **Follows existing convention** — errors already had `.status`; routes
  simply weren't using it.
- **Consistent error format** — all domain errors produce `{ error:
  message }` with the correct HTTP status instead of ad-hoc responses.
- **Safety net** — unknown errors are caught and logged rather than
  crashing the response or leaking stack traces.

## Consequences

- Any object with a numeric `.status` property is treated as a domain
  error. This is a benign trade-off — no built-in object has a `.status`
  that would collide accidentally.
- Unknown errors are silently logged and returned as 500. In
  debug/staging environments, consider adding rethrow behaviour.
- Tests import errors via the re-exports from service files. If the
  re-exports are ever removed, test imports will need updating.
- Future architecture reviews should not suggest splitting errors back
  into service files — that would reintroduce the duplication this ADR
  resolved.
