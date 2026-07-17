# Notes

## User
- Target: deploy **deplacementapp** (Next.js standalone + Prisma + Postgres) on **Coolify**.
- Prior Docker exposure: has run `docker compose up` and copied commands, but doesn't understand what's happening underneath. Treat as "command-line fluency, conceptual gaps".
- Wants to deploy this specific app, but also wants enough conceptual understanding to debug and configure confidently (not just blindly copy).
- Prefers to learn in this repo's context, not via abstract examples.

## Teaching approach
- Ground everything in `Dockerfile`, `compose.yml`, `docker-entrypoint.sh` of THIS repo. Don't invent generic examples.
- Build storage strength via retrieval practice (quizzes) on the conceptual model, not just procedures.
- Sequence toward Coolify as the final assembly point: Docker primitives → this repo's Dockerfile stages → compose → Coolify mapping → first deploy.
- Each lesson ends with one concrete thing to inspect or do in the real repo.

## Watch-outs in the repo
- `.env` contains what looks like a real DB password (`Mmmm2005.`) and a placeholder `NEXTAUTH_SECRET`. Flag to user: rotate before deploy. Do NOT commit secrets.
- `next.config.mjs` uses `output: 'standalone'` — this is why the Dockerfile copies `.next/standalone` and runs `node server.js` (not `next start`). Worth a dedicated mini-lesson; many deploy guides miss it.
- Prisma is wired deep in the runtime image: migrations run in the entrypoint, and `node_modules/.prisma`, `node_modules/@prisma`, `node_modules/prisma` are copied explicitly. Easy to break with a "tidy" edit.

## Communities (to surface later once user is deploy-ready)
- Coolify Discord (linked from https://coolify.io/docs/) — official, active, maintainer-present.
- r/selfhosted — broader self-hosting context.
- Defer suggesting until after first deploy so the suggestions have a concrete use case.
