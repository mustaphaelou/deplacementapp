# Research: Backend Architecture Patterns for a Next.js + Prisma Monolith

**Generated:** 2026-07-23

## Primary Sources Consulted

| Source | Author | Type |
|---|---|---|
| [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | Robert C. Martin (2012) | Primary: author's blog |
| [Clean Architecture: A Craftsman's Guide](https://www.amazon.com/Clean-Architecture-Craftsmans-Software-Structure/dp/0134494164) | Robert C. Martin (2017) | Primary: book |
| [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/) | Alistair Cockburn (2005) | Primary: original paper |
| [Domain-Driven Design: Tackling Complexity in the Heart of Software](https://www.dddcommunity.org/book/) | Eric Evans (2003) | Primary: book |
| [Next.js Project Structure docs](https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/02-project-structure.mdx) | Vercel | Primary: official docs |
| [Next.js Backend for Frontend guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/backend-for-frontend.mdx) | Vercel | Primary: official docs |
| [Prisma Best Practices](https://www.prisma.io/docs/orm/more/best-practices) | Prisma | Primary: official docs |
| [Prisma multi-file schema docs](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) | Prisma | Primary: official docs |

---

## 1. Current Architecture Assessment

### What exists now

The backend is a **Next.js 16 monolith** using the App Router (`app/api/`). All server-side logic lives in a flat `lib/` directory (25+ files) organized by domain concept (demande, notification, utilisateur, workflow). Key patterns already in use:

- **Command-Query Separation (CQS)** — explicit query classes and command/mutation methods
- **Manual DI** via constructor injection with module-level singletons
- **Custom state machine** (pure functions in `workflow.ts`)
- **Event bus** pattern for audit logging and notification dispatch
- **Typed domain errors** with unified error handler
- **Adapter pattern** in a few places (NotificationAdapter, PdfRendererAdapter, AvatarStorage)

### Strengths

- Already has **domain-oriented modules** (demande/, notification/, workflow/) — not a dump of everything
- **Thin route handlers** that delegate — a key Clean Architecture principle (`app/api/` files are mostly <50 lines)
- **Adapter interfaces** exist for external services (notification, PDF, avatar) — this is straight out of Cockburn's Hexagonal Architecture
- **Constructor injection** makes unit testing possible

### Weaknesses identified

1. **`lib/` is a flat dumping ground** — 25+ files with no subdirectory organization. Domain, infrastructure, and application layers intermingle.
2. **No Port/Adapter boundaries on the database** — services depend directly on PrismaClient, not on repository interfaces. This violates both Clean Architecture's Dependency Rule and Hexagonal Architecture's port/adapter split.
3. **No explicit domain layer** — Prisma models ARE the domain. Business rules and data access are coupled. Evans' DDD distinguishes between domain entities and persistence concerns.
4. **No config module** — environment variables are accessed ad-hoc via `process.env`. The Twelve-Factor App recommends centralized config.
5. **Route handlers are coupled to Next.js** (`NextResponse`, `NextRequest`) — this is always true in Next.js App Router, but the **application services** should not depend on framework types.
6. **No clear dependency direction enforcement** — nothing prevents a "query" file from importing a "service" file, which violates inward-only dependency flow.

---

## 2. Pattern Comparison

### Clean Architecture (Martin)

**Core rule:** Source code dependencies point inward. Nothing in an inner circle can know about something in an outer circle.

```
Frameworks & Drivers  →  Interface Adapters  →  Use Cases  →  Entities
(outer)                                                       (inner)
```

**Relevance to this app:**

- **Entities layer** (innermost) — Pure business objects. In this app, these would be the domain concepts: `Demande`, `Utilisateur`, `Notification`, `Vehicule`. Currently these are just Prisma models — there's no domain entity layer independent of the ORM.
- **Use Cases layer** — Application-specific business rules. This is roughly what `demande-service.ts`, `demande-workflow.ts`, `utilisateur-service.ts` already do. But they depend on Prisma directly, so they're not truly "inner circle."
- **Interface Adapters** — Controllers, Presenters, Repository implementations. Route handlers are here. Prisma code should be here. Currently Prisma is injected directly into services.
- **Frameworks & Drivers** — Next.js, PostgreSQL. This is the outermost layer.

**Source:** Martin, *The Clean Architecture* (2012), blog.cleancoder.com: "Source code dependencies can only point inwards. Nothing in an inner circle can know anything at all about something in an outer circle."

### Hexagonal Architecture / Ports & Adapters (Cockburn)

**Core rule:** "Create your application to work without either a UI or a database so you can run automated regression-tests against the application."

```
[Adapter: GUI]  →  [Port: UseCase API]  →  [App Core]  ←  [Port: Repository API]  ←  [Adapter: Prisma]
[Adapter: Test] →                                              ← [Adapter: Mock DB]
```

**Relevance to this app:**

- The existing `NotificationAdapter` / `PrismaNotificationAdapter` and `PdfRendererAdapter` / `travel-request-pdf-adapter` pairs are **perfect examples** of Ports & Adapters.
- **Missing:** A `DemandeRepository` port that the service depends on, with a `PrismaDemandeRepository` adapter. Currently `DemandeQueries` and `DemandeFactory` take PrismaClient directly.
- The **primary (driving) side** adapters (Next.js route handlers) are appropriately thin.
- The **secondary (driven) side** adapters (database, email, storage) are inconsistently implemented — email has an adapter, database does not.

**Source:** Cockburn, *Hexagonal Architecture* (2005): "Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."

### Domain-Driven Design Layered Architecture (Evans)

**Core layers Evans proposes:**

```
User Interface  →  Application Layer  →  Domain Layer  →  Infrastructure
```

- **Domain Layer** — "Responsible for representing concepts of the business, information about the business situation, and business rules." This layer is completely absent from the current codebase. Business logic lives in "services" that mix domain rules with infrastructure concerns.
- **Application Layer** — "Defines the jobs the software is supposed to do and directs the expressive domain objects to work out problems." This is what `demande-service.ts` approximates.
- **Infrastructure Layer** — "Provides generic technical capabilities that support the higher layers." Prisma, email, file storage.

**Relevance:** The app's domain (travel request approval workflow with roles, state machine, notifications) is complex enough to benefit from a dedicated domain layer. Currently, domain logic leaks into services.

**Source:** Evans, *Domain-Driven Design* (2003), Chapter 4: "Layered Architecture."

---

## 3. Improvement Recommendations

### Recommendation 1: Restructure `lib/` into explicit layers

Replace the flat `lib/` with a layered structure:

```
src/
├── domain/                  # Innermost: pure business logic, no framework deps
│   ├── demande/
│   │   ├── demande.entity.ts       # Pure domain entity
│   │   ├── demande.repository.ts   # Port (interface)
│   │   ├── demande-workflow.ts     # State machine (already pure!)
│   │   └── demande-event.ts        # Domain events
│   ├── utilisateur/
│   │   ├── utilisateur.entity.ts
│   │   └── utilisateur.repository.ts
│   ├── notification/
│   │   ├── notification.entity.ts
│   │   └── notification.repository.ts
│   ├── vehicule/
│   │   ├── vehicule.entity.ts
│   │   └── vehicule.repository.ts
│   └── value-objects/        # Shared domain concepts
│       ├── montant.ts
│       └── etat.ts
├── application/              # Use cases / application services
│   ├── demande/
│   │   ├── soumettre-demande.usecase.ts
│   │   ├── approuver-demande.usecase.ts
│   │   └── lister-demandes.usecase.ts
│   ├── utilisateur/
│   │   ├── creer-utilisateur.usecase.ts
│   │   └── modifier-profil.usecase.ts
│   └── notification/
│       └── marquer-lue.usecase.ts
├── infrastructure/           # Adapter implementations
│   ├── persistence/
│   │   ├── prisma-demande.repository.ts
│   │   ├── prisma-utilisateur.repository.ts
│   │   └── prisma-notification.repository.ts
│   ├── email/
│   │   └── nodemailer.adapter.ts
│   ├── pdf/
│   │   └── react-pdf.adapter.ts
│   └── storage/
│       └── filesystem-avatar.storage.ts
├── presentation/             # Next.js route handlers (thin)
│   ├── api/
│   │   ├── demandes/
│   │   ├── utilisateurs/
│   │   └── ...
│   └── middleware/
│       ├── auth-guard.ts
│       └── role-guard.ts
└── config/
    └── index.ts              # Centralized env config
```

This mirrors the Clean Architecture concentric layers and the DDD Layered Architecture.

**Justification:** Martin (2012): "The overriding rule that makes this architecture work is The Dependency Rule. This rule says that source code dependencies can only point inwards."

### Recommendation 2: Extract repository ports for database access

The key change: services should depend on repository **interfaces** (ports), not on PrismaClient directly.

```typescript
// domain/demande/demande.repository.ts — Port
export interface DemandeRepository {
  findById(id: string): Promise<Demande | null>;
  findMany(filters: DemandeFilters): Promise<Demande[]>;
  save(demande: Demande): Promise<void>;
  delete(id: string): Promise<void>;
}

// infrastructure/persistence/prisma-demande.repository.ts — Adapter
export class PrismaDemandeRepository implements DemandeRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Demande | null> {
    const record = await this.prisma.demandeDeplacement.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }
  // ...
}
```

**Justification:** Martin (2012): "Independent of Database. You can swap out Oracle or SQL Server, for Mongo, BigTable, CouchDB, or something else." Cockburn (2005): "The application is blissfully ignorant of the nature of the input device."

### Recommendation 3: Extract a pure domain entity layer

Pull domain concepts out of Prisma models so business rules can be tested without a database. The state machine (`workflow.ts`) is already a good example of pure domain logic — it has zero Prisma imports. Extend this pattern to `Demande`, `Utilisateur`, etc.

**Justification:** Evans (2003): "The domain layer is responsible for representing concepts of the business." Martin (2012): "The business rules can be tested without the UI, Database, Web Server, or any other external element."

### Recommendation 4: Add a centralized config module

```typescript
// config/index.ts
export const config = {
  db: { url: process.env.DATABASE_URL! },
  auth: { secret: process.env.NEXTAUTH_SECRET! },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
} as const;
```

Instead of scattering `process.env.SMTP_*` across `email-service.ts`, `avatar-storage.ts`, etc.

### Recommendation 5: Keep API routes thin, move orchestration to application services

Current route handlers already delegate — good. But some handlers contain inline logic (e.g., csv export, dashboard). These should become use cases in the `application/` layer.

### Recommendation 6: Use Prisma multi-file schema for large schemas

Prisma v6.7.0+ supports multi-file schemas. The current `schema.prisma` has 7 models — not yet large enough to warrant splitting, but worth knowing about.

**Source:** [Prisma multi-file schema docs](https://www.prisma.io/docs/orm/reference/prisma-schema-reference): "For large projects, use multi-file Prisma schemas."

---

## 4. Effort / Impact Assessment

| Recommendation | Effort | Impact | Why |
|---|---|---|---|
| 1. Restructure `lib/` into layers | Medium | High | Primarily file moves + import updates. No logic change. |
| 2. Repository ports for DB | Medium-High | High | Requires extracting interfaces, rewriting service constructors, updating tests. High payoff for testability. |
| 3. Pure domain entity layer | High | High | Most invasive change. Requires modeling domain objects separate from Prisma records. |
| 4. Config module | Low | Medium | Mechanical extraction. ~30 min. |
| 5. Thin API handlers | Low | Medium | Some handlers already thin; a few need extraction. |
| 6. Multi-file schema | Low | Low | Not urgent at current schema size. |

---

## 5. Recommended Order of Changes

1. **Low-hanging fruit (now):** Config module + move files into layer directories (no interface extraction yet).
2. **Short-term:** Extract repository ports for the `Demande` domain (highest value — it's the core domain). This enables swapping Prisma for mocks in tests.
3. **Medium-term:** Extract pure domain entities. The state machine (`workflow.ts`) is already done — use it as a template.
4. **Ongoing:** Keep route handlers thin as new endpoints are added.
