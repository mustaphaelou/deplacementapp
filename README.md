# DéplacementApp — Travel Request Management

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A multi-stage business travel request system for Moroccan organisations. Employees submit trip requests that flow through a configurable approval pipeline — manager review, finance review, and direction approval — with notifications, audit logging, PDF generation, and company-branded emails.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **UI** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/), [Lucide](https://lucide.dev/) & [Hugeicons](https://hugeicons.com/) |
| **Auth** | [NextAuth v5](https://next-auth.js.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) |
| **ORM** | [Prisma 7](https://www.prisma.io/) |
| **Forms** | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| **PDF** | [@react-pdf/renderer](https://react-pdf.org/) |
| **Email** | [Nodemailer](https://nodemailer.com/) |
| **Container** | [Docker](https://www.docker.com/) (multi-stage builds, GHCR publish) |
| **Deployment** | VPS with Docker Compose |
| **Testing** | [Vitest](https://vitest.dev/) |

## Quick Start (Development)

**Prerequisites:** Docker, Git

```bash
git clone https://github.com/mustaphaelou/deplacementapp.git
cd deplacementapp

# Copy environment variables
cp .env.example .env

# Start all services (app, database, mail catcher)
docker compose -f compose.yaml -f compose.dev.yml up --build
```

The app starts at `http://localhost:3000`. A Mailpit web UI for inspecting emails is at `http://localhost:8025`.

### First run — setup wizard

On first boot with an empty database the login page shows a **setup wizard** that creates your organisation (Societe), departments, and initial admin user.

## VPS Deployment

Deploy with Docker Compose and a bundled database on a single VPS.

### 1. Create `compose.prod.yml`

The production `compose.yaml` pulls pre-built images from GHCR. For VPS deployment, override it to **build from source** and bundle a PostgreSQL service:

```yaml
# compose.prod.yml — merge on top of compose.yaml for VPS deployment
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

### 2. Set environment variables

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

### 3. Deploy

```bash
docker compose -f compose.yaml -f compose.prod.yml up --build -d
```

Uploads (avatars) persist via the `uploads` named volume in `compose.yaml`.

## Project Structure

```
├── app/                     # Next.js App Router pages & API routes
│   ├── (auth)/login/        # Login + setup wizard
│   ├── (dashboard)/         # Dashboard, demandes, administration, profil
│   └── api/                 # API route handlers
├── components/              # React components
│   ├── ui/                  # Base UI primitives (shadcn)
│   ├── pdf/                 # PDF templates + adapter
│   ├── demande-form.tsx     # Travel request form
│   ├── demande-detail.tsx   # Travel request detail view
│   ├── sidebar.tsx          # Dashboard sidebar
│   └── ...
├── lib/                     # Business logic, services, types
│   ├── demande/             # Hexagonal architecture (ports/adapters/DI)
│   │   ├── ports/           # Interface contracts
│   │   ├── adapters/        # Prisma implementations
│   │   └── di.ts            # Dependency injection wiring
│   ├── workflow.ts          # State machine (Etape + Decision model)
│   ├── demande-service.ts   # Travel request service
│   ├── authorization.ts     # Role-based access control
│   ├── notification-bus.ts  # In-app notification dispatch
│   ├── email-service.ts     # Email sending
│   ├── audit-bus.ts         # Audit logging
│   └── ...
├── prisma/                  # Database schema, migrations, seed
├── hooks/                   # React hooks
├── types/                   # TypeScript declarations
├── CONTEXT.md               # Domain glossary (ubiquitous language)
├── Dockerfile               # Multi-stage build (deps → builder → migrator → runner)
├── docker-compose.yaml      # Production compose (GHCR images)
├── compose.dev.yml          # Dev overrides (local DB + Mailpit)
└── proxy.ts                 # Dev proxy configuration
```

## Domain Model

The application uses a **Domain-Driven Design** vocabulary documented in [`CONTEXT.md`](./CONTEXT.md). Key concepts:

- **Societe** — the organisation that deploys the app (branding, email identity)
- **DemandeDeplacement** — a travel request with a lifecycle through 5 stages (DRAFT → MANAGER_REVIEW → FINANCE_REVIEW → DIRECTION_REVIEW → FINAL)
- **Etape + Decision** — the conceptual state model (e.g., at MANAGER_REVIEW with Decision APPROVED)
- **StatutDemande** — the persisted enum mapping (9 values like SOUMISE, APPROUVEE_MANAGER, etc.)
- **Utilisateur** — a user with a Role (EMPLOYEE, MANAGER, FINANCE_ADMIN, GENERAL_DIRECTION)
- **Role-based pipeline** — each stage has exactly one role that can act
- **Terminal outcomes** — APPROVED, REJECTED, and WITHDRAWN freeze the demande permanently

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run prisma:seed` | Seed the database |
| `npm run docker:dev` | Start dev environment with Docker |
| `npm run docker:prod` | Start production stack with Docker |
| `npm run docker:down` | Stop and remove Docker volumes |

## License

MIT
