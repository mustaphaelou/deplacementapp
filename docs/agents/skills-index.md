# Skills Index

Matt Pocock engineering skills (plus shadcn skills) are installed at:

```
C:\Users\musta\.agents\skills\
```

(WSL path: `/mnt/c/Users/musta/.agents/skills/`)

Each skill is a folder containing a `SKILL.md` markdown file with its trigger, context load, procedure, and completion criteria. To use a skill, read its `SKILL.md` and follow the procedure.

## How to invoke a skill on Cline

Cline doesn't support slash-command skill loading natively. Instead:

1. **Ask by name** — e.g. "use the `research` skill" or "run `code-review` on my changes." I will read the corresponding `SKILL.md` from the path above and follow its instructions.
2. **Ask by situation** — e.g. "I need to research X" and I'll match it to the right skill using the table below.

## Available skills

### Foundation

| Skill | When to invoke | Path |
|-------|---------------|------|
| `setup-matt-pocock-skills` | First time in a new repo — bootstraps issue tracker, triage labels, domain docs | `skills/setup-matt-pocock-skills/SKILL.md` |
| `writing-great-skills` | Read when authoring or editing a skill (reference, not invoked) | `skills/writing-great-skills/SKILL.md` |

### Discovery & Research

| Skill | When to invoke | Path |
|-------|---------------|------|
| `research` | Need facts from primary sources (docs, source code, specs) | `skills/research/SKILL.md` |
| `ubiquitous-language` | Need to extract a glossary from conversation | `skills/ubiquitous-language/SKILL.md` |
| `domain-modeling` | Need to sharpen fuzzy domain terms or create an ADR | `skills/domain-modeling/SKILL.md` |
| `codebase-design` | Need vocabulary for deep module design discussions | `skills/codebase-design/SKILL.md` |

### Design & Planning

| Skill | When to invoke | Path |
|-------|---------------|------|
| `design-an-interface` | Want to explore interface alternatives with different constraints | `skills/design-an-interface/SKILL.md` |
| `to-spec` | Ready to synthesize conversation into a PRD issue | `skills/to-spec/SKILL.md` |
| `to-tickets` | Need to break a spec into vertical-slice tickets | `skills/to-tickets/SKILL.md` |
| `to-questionnaire` | Need to turn a spec into a questionnaire | `skills/to-questionnaire/SKILL.md` |
| `request-refactor-plan` | Want to plan a refactor as tiny commits | `skills/request-refactor-plan/SKILL.md` |
| `wayfinder` | Need to plan huge work spanning multiple sessions | `skills/wayfinder/SKILL.md` |

### Critique

| Skill | When to invoke | Path |
|-------|---------------|------|
| `grill-me` | Want a relentless interview to sharpen a plan or design | `skills/grill-me/SKILL.md` |
| `grill-with-docs` | Grill + create ADRs and glossary as you go | `skills/grill-with-docs/SKILL.md` |
| `grilling` | Core grilling procedure (shared by grill skills) | `skills/grilling/SKILL.md` |
| `batch-grill-me` | Want all questions at once, round by round (faster) | `skills/batch-grill-me/SKILL.md` |
| `loop-me` | Grilling specs for workflows you want to build | `skills/loop-me/SKILL.md` |

### Building

| Skill | When to invoke | Path |
|-------|---------------|------|
| `implement` | Have a spec/tickets and need code written | `skills/implement/SKILL.md` |
| `tdd` | Want test-first discipline (reference, not invoked) | `skills/tdd/SKILL.md` |
| `prototype` | Need a throwaway to test an idea | `skills/prototype/SKILL.md` |
| `improve-codebase-architecture` | Need to improve codebase architecture | `skills/improve-codebase-architecture/SKILL.md` |

### Quality

| Skill | When to invoke | Path |
|-------|---------------|------|
| `code-review` | Need changes reviewed on Standards and Spec axes | `skills/code-review/SKILL.md` |
| `qa` | Want to report bugs conversationally | `skills/qa/SKILL.md` |
| `triage` | Need to process issues through the state machine | `skills/triage/SKILL.md` |
| `diagnosing-bugs` | Need to diagnose a bug systematically | `skills/diagnosing-bugs/SKILL.md` |
| `resolving-merge-conflicts` | Need help resolving merge conflicts | `skills/resolving-merge-conflicts/SKILL.md` |

### Handoff

| Skill | When to invoke | Path |
|-------|---------------|------|
| `handoff` | Need to compact conversation for the next agent session | `skills/handoff/SKILL.md` |
| `claude-handoff` | Need a fresh background agent to pick up work immediately | `skills/claude-handoff/SKILL.md` |
| `teach` | Need to teach/learn a concept | `skills/teach/SKILL.md` |

### Specialized

| Skill | When to invoke | Path |
|-------|---------------|------|
| `shadcn` | Working with shadcn/ui components | `skills/shadcn/SKILL.md` |
| `wizard` | Need an interactive bash wizard for a manual procedure | `skills/wizard/SKILL.md` |
| `migrate-radix-to-base` | Migrating from Radix UI to Base UI | `skills/migrate-radix-to-base/SKILL.md` |
| `migrate-to-shoehorn` | Replacing `as` assertions with shoehorn | `skills/migrate-to-shoehorn/SKILL.md` |
| `setup-pre-commit` | Adding Husky + lint-staged hooks | `skills/setup-pre-commit/SKILL.md` |
| `setup-ts-deep-modules` | Wiring dependency-cruiser for deep modules | `skills/setup-ts-deep-modules/SKILL.md` |
| `git-guardrails-claude-code` | Blocking dangerous git commands | `skills/git-guardrails-claude-code/SKILL.md` |
| `obsidian-vault` | Managing Obsidian vault notes | `skills/obsidian-vault/SKILL.md` |
| `scaffold-exercises` | Creating exercise templates | `skills/scaffold-exercises/SKILL.md` |

### Writing

| Skill | When to invoke | Path |
|-------|---------------|------|
| `writing-fragments` | Exploring raw material, no structure yet | `skills/writing-fragments/SKILL.md` |
| `writing-shape` | Shaping fragments into paragraphs | `skills/writing-shape/SKILL.md` |
| `writing-beats` | Assembling into a journey of beats | `skills/writing-beats/SKILL.md` |
| `edit-article` | Editing an existing draft | `skills/edit-article/SKILL.md` |

### Meta

| Skill | When to invoke | Path |
|-------|---------------|------|
| `ask-matt` | Not sure which skill fits — a router | `skills/ask-matt/SKILL.md` |

## Every skill's shape

1. **Trigger** — situation that calls for it
2. **Context load** — what it reads to understand
3. **Procedure** — steps it follows
4. **Completion criteria** — what signals done

All Matt skills are **user-invoked** (you say when) unless noted.