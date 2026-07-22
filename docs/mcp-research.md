# MCP Research: deplacementapp

> Generated: 2026-07-21
> Purpose: Identify MCP servers that add value for this project's tech stack and workflows.

---

## 1. Codebase Summary

| Dimension | Detail |
|-----------|--------|
| **Project** | Travel request system (`DemandeDeplacement`) — multi-stage approval pipeline for employee business trips |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **UI** | shadcn/ui (Base UI), HugeIcons, Lucide React, sonner (toasts) |
| **Forms** | react-hook-form + Zod v4 |
| **Database** | Prisma ORM 7.x + PostgreSQL 16 |
| **Auth** | NextAuth v5 |
| **Email** | Nodemailer (SMTP via Mailpit in dev) |
| **PDF** | @react-pdf/renderer |
| **Infra** | Docker multi-stage build, Docker Compose |
| **Deploy** | Coolify (self-hosted PaaS target) |
| **Testing** | Vitest |
| **Issue tracker** | GitHub (`mustaphaelou/deplacementapp`) |
| **Domain docs** | `CONTEXT.md` + `docs/adr/` |

---

## 2. Current MCP Configuration

**None.** No `.opencode/`, `.cursor/`, `.vscode/`, or `opencode.json` files exist. The project has never configured MCP. The only agent-related configuration is:

- `AGENTS.md` — references issue tracker, triage labels, and domain docs conventions
- `C:\Users\musta\.config\opencode\AGENTS.md` — configures **context7** MCP server for documentation queries

---

## 3. Recommended MCP Servers

### 3.1 next-devtools-mcp (Vercel) — **Essential**

| | |
|---|---|
| **What it does** | Connects coding agents to a running Next.js 16+ dev server, providing live state: build/runtime/type errors, route map, page metadata, Server Actions, dev logs |
| **Why for this project** | This is a Next.js 16 App Router project. `next-devtools-mcp` gives any agent real-time insight into the running app — routes, errors, component metadata — without guesswork. Zero config if Next.js 16 is installed. |
| **Source** | https://github.com/vercel/next-devtools-mcp |
| **Docs** | https://nextjs.org/docs/app/guides/mcp |
| **Install** | `npx -y next-devtools-mcp@latest` |

### 3.2 GitHub MCP Server (Official) — **Essential**

| | |
|---|---|
| **What it does** | Official GitHub integration: read repos, manage issues/PRs, analyze code, automate workflows. Supports remote (OAuth/PAT) or local (Docker) modes. |
| **Why for this project** | Issues are tracked in `mustaphaelou/deplacementapp` on GitHub. This server lets agents read issues, create PRs, review code, and manage the full GitHub workflow from within the IDE. |
| **Source** | https://github.com/github/github-mcp-server |
| **Docs** | https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server |
| **Install** | Remote: `https://api.githubcopilot.com/mcp/` with OAuth or PAT |

### 3.3 Prisma MCP Server (Official) — **High value**

| | |
|---|---|
| **What it does** | Manages Prisma Postgres databases: create/list/delete databases, run SQL queries, introspect schemas, manage backups, **search Prisma documentation** with citations. Has both a remote server (`https://mcp.prisma.io/mcp`) and a local CLI-based server. |
| **Why for this project** | This is a Prisma + PostgreSQL project. The `search_prisma_documentation` tool alone is valuable — it lets agents answer Prisma ORM questions with cited docs. The database management tools are useful for dev workflows. |
| **Source** | https://github.com/prisma/mcp |
| **Docs** | https://www.prisma.io/docs/ai/tools/mcp-server |
| **Install** | Remote: `https://mcp.prisma.io/mcp` |

### 3.4 PostgreSQL MCP Server (CrystalDBA / Postgres MCP Pro) — **High value**

| | |
|---|---|
| **What it does** | Provides database health checks, index tuning, EXPLAIN plan analysis, safe SQL execution (configurable read-only mode), schema intelligence, and query optimization. |
| **Why for this project** | Complements Prisma MCP with deeper DBA-grade analysis. The project's state machine (Etape/Decision/StatutDemande) is database-backed. Index tuning and query plan analysis are directly useful for a multi-stage approval workflow with complex queries. |
| **Source** | https://github.com/crystaldba/postgres-mcp |
| **Install** | Docker or `pip install postgres-mcp-pro` |

### 3.5 Coolify MCP Server (StuMason/coolify-mcp) — **High value**

| | |
|---|---|
| **What it does** | 38 optimized tools to manage a Coolify instance: list/start/stop/deploy apps, manage databases, view logs, search docs, batch operations, server diagnostics. |
| **Why for this project** | The deployment target is Coolify. This server lets agents manage the entire deployment pipeline: deploy new versions, check logs, diagnose server issues, manage env vars, restart services — all from the conversation. |
| **Source** | https://github.com/StuMason/coolify-mcp |
| **Alternatives** | https://github.com/kof70/coolify-mcp-server, https://github.com/Theprofitplatform/coolify-mcp-server |
| **Install** | `npx -y @stumason/coolify-mcp` with `COOLIFY_BASE_URL` + `COOLIFY_TOKEN` |

### 3.6 Docker MCP Server (GavinLucas/docker-mcp) — **High value**

| | |
|---|---|
| **What it does** | Full Docker management: containers (create, start, stop, logs, exec), images, volumes, networks, Compose (up/down/logs/config), swarm. Configurable read-only mode. |
| **Why for this project** | The project has a Dockerfile (4-stage) and Docker Compose (app + db + mail). This server lets agents manage the entire Docker lifecycle — check container health, tail logs, exec into containers for debugging, manage Compose stacks. |
| **Source** | https://github.com/GavinLucas/docker-mcp |
| **Alternatives** | https://github.com/ckreiling/mcp-server-docker (simpler) |
| **Install** | `pip install docker-mcp-server` or Docker image `gavinlucas/docker-mcp-server` |

### 3.7 MCP Filesystem (Official) — **Medium value**

| | |
|---|---|
| **What it does** | Official reference server: read/write files, create/list/delete directories, search by glob, get file metadata, sandboxed to allowed directories. Supports MCP roots protocol for dynamic access control. |
| **Why for this project** | The project handles file uploads (avatars at `/uploads/avatars/`, documents attached to DemandeDeplacement, PDF generation). An MCP filesystem server gives agents controlled access to these files. |
| **Source** | https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem |
| **Docs** | https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md |
| **Install** | `npx -y @modelcontextprotocol/server-filesystem <allowed-dirs>` |

### 3.8 SMTP Email MCP Server — **Medium value**

| | |
|---|---|
| **What it does** | Send emails via SMTP using Nodemailer. Supports plain text, HTML, attachments. |
| **Why for this project** | Notifications are a core domain concept — email alerts are sent when a DemandeDeplacement transitions between stages. An SMTP MCP server lets agents send test emails or verify the notification pipeline. |
| **Source** | https://github.com/xstast24/mcp-simple-mail-sender |
| **Alternatives** | https://github.com/u1pns/sendmail-mcp, https://github.com/samihalawa/mcp-server-smtp |
| **Install** | `npx -y mcp-simple-mail-sender` with `SMTP_HOST`, `EMAIL_USER`, `EMAIL_PASS` |

### 3.9 PDF Generation MCP Server — **Medium value**

| | |
|---|---|
| **What it does** | Generate PDFs from Markdown or structured JSON. Supports themes, headers/footers, page numbers, image embedding, templates. |
| **Why for this project** | The project uses `@react-pdf/renderer` — PDF output is clearly part of the domain (travel request summaries, reports). A PDF MCP server lets agents generate and preview PDFs without needing the full React rendering pipeline. |
| **Source** | https://github.com/FabianGenell/pdf-mcp-server |
| **Alternatives** | `@mcp-z/mcp-pdf` (https://mcp-z.github.io/mcp-pdf/), preprint-pdf-mcp |
| **Install** | `npx -y @fabiangenell/pdf-mcp-server` |

### 3.10 MCP Memory (Official) — **Low value / nice-to-have**

| | |
|---|---|
| **What it does** | Knowledge graph-based persistent memory. Stores entities, relationships, and facts across sessions. |
| **Why for this project** | Useful for the agent to remember domain-specific terminology from `CONTEXT.md` (Etape, Decision, Assignataire, etc.) and maintain context about the project's state machine across sessions. |
| **Source** | https://github.com/modelcontextprotocol/servers/tree/main/src/memory |
| **Install** | `npx -y @modelcontextprotocol/server-memory` |

---

## 4. Configuration Priorities

| Priority | MCP Server | Rationale |
|----------|------------|-----------|
| **P0 — Setup now** | next-devtools-mcp | Zero config with Next.js 16, essential for agent awareness of the running app |
| **P0 — Setup now** | GitHub MCP Server | Issues are the project's single source of truth for work tracking |
| **P1 — High value** | Prisma MCP Server | Directly matches ORM + DB stack; docs-search tool alone is worth it |
| **P1 — High value** | Coolify MCP Server | Matches deployment target; enables full deployment lifecycle management |
| **P1 — High value** | Docker MCP Server | Matches infra setup; enables container management without shell |
| **P2 — Situational** | PostgreSQL MCP (Postgres MCP Pro) | For DBA-level analysis of the approval pipeline's data |
| **P2 — Situational** | MCP Filesystem | When agents need controlled access to uploaded files |
| **P2 — Situational** | SMTP Email MCP | For testing/managing the notification pipeline |
| **P2 — Situational** | PDF MCP | For generating/previewing travel request PDFs |
| **P3 — Nice-to-have** | MCP Memory | Cross-session memory of domain language |

---

## 5. Configuration Template

Add to `opencode.json` (or equivalent MCP config for your client):

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
      }
    },
    "prisma": {
      "url": "https://mcp.prisma.io/mcp"
    },
    "coolify": {
      "command": "npx",
      "args": ["-y", "@stumason/coolify-mcp"],
      "env": {
        "COOLIFY_BASE_URL": "https://your-coolify-instance.com",
        "COOLIFY_TOKEN": "<your-token>"
      }
    },
    "docker": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "/var/run/docker.sock:/var/run/docker.sock",
        "gavinlucas/docker-mcp-server"
      ]
    }
  }
}
```

---

## 6. Source Index

| # | Name | URL |
|---|------|-----|
| 1 | Official MCP Registry | https://registry.modelcontextprotocol.io/ |
| 2 | modelcontextprotocol/servers | https://github.com/modelcontextprotocol/servers |
| 3 | punkpeye/awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers |
| 4 | Smithery registry | https://smithery.ai/servers |
| 5 | mcp.so directory | https://mcp.so |
| 6 | Next.js MCP guide | https://nextjs.org/docs/app/guides/mcp |
| 7 | next-devtools-mcp | https://github.com/vercel/next-devtools-mcp |
| 8 | GitHub MCP Server | https://github.com/github/github-mcp-server |
| 9 | Prisma MCP Server | https://github.com/prisma/mcp |
| 10 | Prisma MCP docs | https://www.prisma.io/docs/ai/tools/mcp-server |
| 11 | Postgres MCP Pro | https://github.com/crystaldba/postgres-mcp |
| 12 | Coolify MCP (StuMason) | https://github.com/StuMason/coolify-mcp |
| 13 | Coolify MCP docs | https://coolify.io/docs/integrations/mcp |
| 14 | Docker MCP (GavinLucas) | https://github.com/GavinLucas/docker-mcp |
| 15 | Docker MCP (ckreiling) | https://github.com/ckreiling/mcp-server-docker |
| 16 | MCP Filesystem | https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem |
| 17 | SMTP Email MCP | https://github.com/xstast24/mcp-simple-mail-sender |
| 18 | PDF MCP Server | https://github.com/FabianGenell/pdf-mcp-server |
| 19 | MCP Memory | https://github.com/modelcontextprotocol/servers/tree/main/src/memory |
| 20 | zplatform.ai MCP directory | https://zplatform.ai/mcp-servers/ |
| 21 | sunnamed434/awesome-mcp-registry | https://github.com/sunnamed434/awesome-mcp-registry |
