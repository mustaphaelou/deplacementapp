# Agent Briefs

An agent brief is a comment posted on an issue when it reaches `ready-for-agent`. It gives an AFK agent everything they need to implement the issue with zero human context.

## Structure

```markdown
## Agent Brief

**Goal:** One sentence describing the deliverable.

**Context:**
- Terms from CONTEXT.md this touches
- Relevant code paths / files
- Related issues or ADRs

**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Constraints:**
- Constraint 1
- Constraint 2

**Verification:**
- How to test this works
```

## Rules

- Use domain terms from `CONTEXT.md` exactly as defined.
- Reference ADRs that constrain the solution.
- Acceptance criteria must be verifiable — no "make it good."
- Constraints must be concrete — no "keep it simple."
- If the agent might need a design decision, make it for them.
- Keep briefs self-contained: the agent should not need to read the whole codebase.

## For human-ready issues

Same structure, but add a **Why human** section explaining what the agent can't do (judgment calls, external access, manual testing, design ambiguity).
