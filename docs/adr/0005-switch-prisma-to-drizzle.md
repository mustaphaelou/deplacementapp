# Switch from Prisma ORM to Drizzle ORM

We are replacing Prisma ORM v7.9 (engine-based, schema-first) with Drizzle ORM (zero-dependency, code-first, SQL-like query builder) to reduce bundle size and enable native edge-runtime deployment without a commercial proxy. The switch is big-bang: all Prisma code is removed in a single pass, the `.prisma` schema is replaced with TypeScript definitions in `db/schema/`, and the `StatutDemande` single-column enum is split into persisted `etape` + `decision` columns to match the conceptual model already documented in CONTEXT.md.

## Status

Accepted

## Considered Options

- **Prisma Accelerate** — would solve edge deployment but introduces a paid commercial dependency and adds latency through the proxy layer. Rejected because we want full control over the query path and zero third-party infrastructure for basic reads.
- **Incremental migration** — wrapping each service behind a port first, then swapping implementations one-by-one. Rejected because the existing codebase already mixes ports (demande) with direct Prisma calls (everything else), and maintaining two ORMs in flight adds complexity without clear benefit for a project of this size.
- **Manual SQL / query builder only** — dropping ORMs entirely. Rejected because Drizzle's type-safe schema and relational query API provide enough value over raw SQL to justify the abstraction.

## Consequences

- The migrator Docker stage switches from `prisma migrate deploy` to `drizzle-kit migrate`.
- The `lib/prisma.ts` singleton is replaced with a Drizzle client singleton.
- All `@prisma/client` imports (types, enums, PrismaClient) are replaced with Drizzle equivalents.
- The `StatutDemande` enum column becomes two columns (`etape`, `decision`) with a conversion migration that backfills existing rows via the `fromLegacyStatus` mapping.
- Tests are rewritten to use Drizzle's query builder directly instead of mocking PrismaClient.
- Project no longer needs the Prisma CLI or engine binary at build or runtime.
