# DéplacementApp — Travel Request Management

A multi-stage business travel request system for Moroccan organisations. Employees submit trip requests that flow through an approval pipeline — manager review, finance review, direction approval — with notifications, audit logging, PDFs, and company-branded emails.

## Quick Start

**Prerequisites:** Docker, Git

```bash
git clone https://github.com/mustaphaelou/deplacementapp.git
cd deplacementapp
cp .env.example .env
docker compose -f compose.yaml -f compose.dev.yml up --build
```

Open [localhost:3000](http://localhost:3000). On first boot the login page shows a **setup wizard** that creates your organisation, departments, and first admin user. Emails are intercepted by [Mailpit](http://localhost:8025).

## Deployment

Deploy on a VPS with Docker Compose and a bundled Postgres.

**1. Create `compose.prod.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 15s

  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: migrator
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=${DATABASE_URL}

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}

volumes:
  pgdata:
```

**2. Set environment variables**

```bash
DATABASE_URL=postgresql://user:pass@db:5432/deplacementapp
POSTGRES_USER=user
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=deplacementapp
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
SMTP_FROM=noreply@your-domain.com
```

**3. Deploy**

```bash
docker compose -f compose.yaml -f compose.prod.yml up --build -d
```

Uploads (avatars) persist via the `uploads` named volume in `compose.yaml`.

## Project Structure

```
├── app/                     # Next.js App Router (pages + API routes)
│   ├── (auth)/login/        # Login + setup wizard
│   ├── (dashboard)/         # Dashboard, demandes, administration, profil
│   └── api/                 # Route handlers
├── components/              # React components
│   ├── ui/                  # Base UI primitives
│   ├── pdf/                 # PDF templates + adapter
│   └── ...
├── lib/                     # Business logic
│   ├── demande/             # Hexagonal architecture (ports/adapters/DI)
│   ├── workflow.ts          # State machine (5-stage approval pipeline)
│   ├── demande-service.ts
│   ├── authorization.ts     # Role-based access control
│   ├── notification-bus.ts
│   ├── email-service.ts
│   └── audit-bus.ts
├── db/                      # Drizzle schema + migrations + seed
├── CONTEXT.md               # Domain glossary
└── Dockerfile               # Multi-stage (4 targets)
```

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **UI** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/), [Lucide](https://lucide.dev/) & [Hugeicons](https://hugeicons.com/) |
| **Auth** | [NextAuth v5](https://next-auth.js.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Forms** | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| **PDF** | [@react-pdf/renderer](https://react-pdf.org/) |
| **Email** | [Nodemailer](https://nodemailer.com/) |
| **Container** | [Docker](https://www.docker.com/) (multi-stage, GHCR publish) |
| **Testing** | [Vitest](https://vitest.dev/) |

## Domain Model

The [domain glossary](CONTEXT.md) uses a strict vocabulary. Key concepts:

- **Societe** — the deploying organisation (branding, email identity)
- **DemandeDeplacement** — a travel request through 5 stages (DRAFT → MANAGER_REVIEW → FINANCE_REVIEW → DIRECTION_REVIEW → FINAL)
- **Etape + Decision** — the conceptual state model; persisted as separate columns on `demandes_deplacement`
- **Utilisateur** — a user with one of 4 roles (EMPLOYEE, MANAGER, FINANCE_ADMIN, GENERAL_DIRECTION)
- Each stage has exactly one role that can act; terminal outcomes (APPROVED, REJECTED, WITHDRAWN) freeze the demande permanently

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run db:generate` | Generate Drizzle client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run docker:dev` | Start dev Docker stack |
| `npm run docker:prod` | Start production stack |
| `npm run docker:down` | Stop and clean volumes |

## License

MIT
