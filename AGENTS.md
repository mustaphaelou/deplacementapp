## Agent skills

### Matt Pocock skills (external)

Skills are installed at `C:\Users\musta\.agents\skills\` (WSL: `/mnt/c/Users/musta/.agents/skills/`). Each skill is a `SKILL.md` file. See `docs/agents/skills-index.md` for the full list and usage instructions.

When the user asks to use a skill (e.g. "use the `research` skill", "run `code-review`", or describes a situation that matches a skill), read the corresponding `SKILL.md` from that path and follow its procedure.

### Issue tracker

Issues live as GitHub issues in `mustaphaelou/deplacementapp`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role names are used as-is for GitHub labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
