# ADR 0006: Collapse single-adapter seams at local-substitutable boundaries

**Date:** 2026-07-27

**Status:** Accepted

## Context

When the DemandeDeplacement module was refactored in commit `0b6842f`, three repository port interfaces (`DemandeQueryPort`, `DemandeFactoryPort`, `DemandeWorkflowPort`) and their single Prisma adapter implementations were extracted into `lib/demande/ports/` and `lib/demande/adapters/`. A DI wiring module (`lib/demande/di.ts`) was added to construct the service with injected ports.

The extraction followed a research exercise documented in `docs/research/enumerate-demande-ports.md` and `docs/research/di-wiring-pattern.md`. These are research notes — not an accepted ADR — and this ADR does not reverse one. The research identified real observations (leaking Prisma types, a `tx` passthrough convention that was never implemented) but the solution it proposed — three identical adapter wrappers over three internal classes — did not earn its place: each port had exactly one adapter, which delegated every method straight through to the original class, adding a type-narrowing layer with no test or runtime benefit. The same commit deleted 741 lines of adapter and service tests (`lib/demande-factory.test.ts`, `lib/demande-queries.test.ts`, `lib/demande-workflow.test.ts`) and never replaced them — the 439 lines of Drizzle persistence logic (transitions, guards, queries) became the least-tested code in the repository.

The seam was local-substitutable: the only thing on the other side of each adapter was the Drizzle client. No alternative implementation existed or was planned. The adapter layer existed because a DI pattern was applied uniformly across services, not because the DemandeDeplacement module needed that level of indirection.

This is consistent with ADR-0005, which rejected incremental migration behind ports for the same reason: the codebase was too small and the seam too local to justify the ceremony.

## Decision

**Do not keep single-adapter seams at local-substitutable boundaries.** When a port has exactly one adapter implementation and the other side of the seam is the database client itself (directly substitutable in tests via PGLite or a mock), collapse the ports and adapters into plain async functions behind a single module entry point.

PGLite (`@electric-sql/pglite`) is the accepted Postgres stand-in for through-interface persistence tests. Tests exercise real SQL through the same function interface production uses — no mocks of query-builder chains, no adapter test doubles. The database swap (PGLite for the production Drizzle client) is an internal seam private to test setup, not exposed through the module's public interface.

### What this means in practice

- The DemandeDeplacement module exposes plain async functions (`findById`, `findMany`, `createDraft`, `executeTransition`, etc.) behind a single entry point (`lib/demande/index.ts`). No class, no constructor, no DI wiring.
- The Drizzle persistence logic is internal implementation. Callers never import `queries.ts` or `mutations.ts` directly.
- The three port interfaces (`DemandeQueryPort`, `DemandeFactoryPort`, `DemandeWorkflowPort`), the three adapter classes, and the DI wiring module are deleted.

### What this does not mean

- **This does not forbid ports entirely.** Where the other side of the seam is a genuinely swappable implementation (a different database, an external service, an email provider), a port interface is appropriate.
- **This does not forbid DI for testability.** Where a module depends on a service with multiple possible implementations (email dispatch, file storage), constructor injection with a default remains the right pattern.
- **This does not re-litigate ADR-0005.** The switch from Prisma to Drizzle stands. The port extraction was a parallel concern — the seams were added on top of Drizzle, not removed by it.

### Research notes retained

The two research documents (`docs/research/enumerate-demande-ports.md`, `docs/research/di-wiring-pattern.md`) are kept in the repository as historical records of the port extraction exercise. They document what was considered, what was learned, and what was ultimately not adopted. Future architecture reviews should treat them as prior art, not as a recommendation to re-extract.

## Rationale

- **741 lines of deleted tests were never replaced.** The adapter layer did not earn test coverage — the original test files were deleted because the adapter wrappers were trivially delegating. The collapse restores test coverage at the module's interface, using PGLite to exercise real persistence.
- **One adapter per port is not a seam.** A seam requires a seam allowance — a place where the software can be held apart and something different inserted. A single adapter that forwards every call adds indirection without enabling anything.
- **PGLite solves the real problem.** The motivation for ports was testability (mocking the database). PGLite provides a real in-process Postgres, eliminating the need to mock Drizzle query chains entirely.
- **Simpler mental model.** Callers import one function from one entry point. No port, no adapter, no DI module. The module boundary is the entry point, not the class hierarchy.

## Consequences

- Future DemandeDeplacement work happens in `lib/demande/` — mutations, queries, and their tests. No adapter indirection to navigate.
- PGLite tests run without Docker or a running database. Tests are fast and deterministic.
- The pure transition table module (`lib/demande/transition-table`) remains untouched — its internal seams and test surface are unrelated.
- Transactional consistency of transition + JournalAudit + Notification is a known, separate issue, tracked as a follow-up (see issue filed alongside this ADR).
- Future reviews should not suggest re-extracting ports at this seam. The decision is recorded here and the research notes explain why the extraction was tried and abandoned.
