# Testing

## The suite count

The count is a claim, and like any claim it is only worth what the conditions
of its measurement were worth. Measure it on a **clean** tree:

```bash
git status --short        # must be empty
npm test                  # ~70s
```

Current baseline on `main`: **1167 passed / 8 skipped across 94 files**.

## Why "clean" is in the sentence

Because the count was wrong by 9 and the wrong number shipped.

An untracked scratch file — `components/byte-identity.harness.test.tsx`,
whose own first line read *"TEMPORARY verification harness — deleted before
the commit lands"* — sat in the working tree across two sessions and a
merge. Vitest collects test files by glob, so it never knew the file was
temporary: **805 was 796 plus 9 tests that existed only on that machine.**

The 805 became the stated baseline in spec #260 and ticket #261, and was
reported back as verified evidence twice ("the count holds exactly against
the 805 baseline"). A green suite says nothing about whether the number it
produced is real, and no gate can catch it from inside the run.

`scripts/baseline-integrity.test.ts` is the gate. It fails when an untracked
test-shaped file would be collected, so a scratch harness cannot quietly
enter the next count.

## When a ticket states a count

State the **delta** and the reason, not just the number. "805 -> ~775, because
consolidation removes 36 duplicated assertions and adds 6" is checkable; a
bare total is only checkable against another bare total measured possibly
somewhere else, possibly on a dirty tree.

If a count and the gate disagree, the gate is right.
