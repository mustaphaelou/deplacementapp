# Out of Scope

The `.out-of-scope/` directory stores rejected enhancement requests so we can recognize and quickly dismiss duplicates.

## When an enhancement is rejected as `wontfix`

1. Write a markdown file to `.out-of-scope/<slug>.md` summarizing:
   - The request
   - Why it was rejected
   - Date rejected
   - Link to the original issue
2. Comment on the issue linking to the file.
3. Close the issue.

## File template

```markdown
# <title>

**Requested:** <date>
**Rejected:** <date>
**Issue:** #<number>

## What was requested

Brief summary.

## Why it was rejected

Clear reasoning so the same request doesn't get reopened verbatim.

## Under what conditions it could be revisited

Optional — if there's a clear trigger (e.g., "once we migrate to PostgreSQL").
```

## Before triaging a new enhancement

Read `.out-of-scope/*.md` and surface any prior rejection that resembles this issue.
