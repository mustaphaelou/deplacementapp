# ADR 0014: Filesystem ordering for mutation writers crossing the DB/filesystem boundary

**Date:** 2026-07-30

**Status:** Accepted

## Context

Prior ADRs established atomicity for DB-only mutation writers:

- **ADR-0007** — Transition side-effects (`appliquerEffets`) run inside the caller's `db.transaction`; audit + notification rows commit together.
- **ADR-0009** — `quitterAmorcage` wraps row writes in `db.transaction`; the in-memory `clearSocieteCache` runs *after* commit.
- **ADR-0011** — `logAudit(event, dbOrTx = db)` is the single audit entrypoint, callable with `tx` for inside-transaction writes.
- **ADR-0012** — `updateSociete` wraps row write + `logAudit(event, tx)` inside `db.transaction`; `clearSocieteCache()` after commit. The pattern for a non-transition mutation writer with only DB + in-memory side-effects.

`UtilisateurService.updateProfile` (`lib/utilisateur-service.ts:197-273`) is the first mutation writer in the codebase that crosses the DB/filesystem boundary. Its avatar-handling branch (`lib/utilisateur-service.ts:234-240`) performs:

1. `avatarStorage.delete(oldUrl)` — filesystem `unlink` (L235-237)
2. `avatarStorage.save(dataUri, userId)` — filesystem `writeFile` (L238-240)
3. `this._db.update(...)` — DB row write (L247-257)
4. `logAudit(...)` — DB audit row (L261-270)

Existing ordering (prior to this ADR): **delete-old → save-new → update row → logAudit** — the filesystem operations run *before* the row write, entirely outside any transaction. This creates a dormant unrecoverable-data-loss window: if `save` throws after `delete` succeeds but before the row update, the committed row references a now-deleted old file and no new file was persisted. The row is *correct* in every DB sense — but the application can't render the avatar because the file doesn't exist on disk.

### The cross-boundary gap

No prior ADR addresses the ordering of filesystem side-effects relative to a DB transaction boundary. The existing patterns (ADR-0007, ADR-0009, ADR-0012) assume all side-effects are either DB writes (inside the tx) or in-memory cache clears (after commit). Filesystem `writeFile` / `unlink` are neither — they cannot participate in the transaction's rollback and have side-effects (orphan files, deleted files) that persist when the transaction is rolled back.

## Decision

**For mutation writers that perform filesystem side-effects (create, delete, or mutate files) in addition to DB writes, the ordering shall be:**

1. **SAVE** new file(s) *before* the transaction opens.
2. **Open `db.transaction`**: DB row write(s) + audit row(s) inside the tx.
3. **DELETE** old file(s) *only after* the transaction commits.
4. **On tx failure**, delete the newly saved file(s) to harvest the orphan; **on no-avatar or save-skipped cases** no harvest needed.

This ensures:
- At the moment the row is committed, the new file (if any) already exists on disk — the row never references a file that has not yet been persisted.
- The old file (if any) is not deleted until the new state is committed — if the tx rolls back, the old file remains on disk and the row still references it correctly.
- On rollback, the new file (now unreferenced by any row) is cleaned up immediately, so a rollback leaves no persistent trace except a harvested orphan.
- On save failure before the tx opens, the entire operation throws *before* any DB write — the old file and old row are untouched (the current code already has this property).

### What this means in practice

`UtilisateurService.updateProfile`'s avatar branch reorders from:

```ts
// Before — pre-existing ordering bug
await this.avatarStorage.delete(oldUrl)       // filesystem unlink
updateData.avatarUrl = await this.avatarStorage.save(data, userId)  // filesystem write
await this._db.update(...).set(updateData)...  // DB row write
await logAudit({...}, this._db)                // DB audit write
```

To:

```ts
// After — Option B ordering (ADR-0014)
if (data.avatarData !== undefined) {
  if (data.avatarData) {
    newUrl = await this.avatarStorage.save(data.avatarData, userId)  // save file before tx
  }
  oldUrl = user.avatarUrl  // remember old URL for post-commit deletion
}

try {
  await this._db.transaction(async (tx) => {
    const [updated] = await tx.update(...).set({ ...updateData, avatarUrl: newUrl ?? null })
    await logAudit({...}, tx)
  })

  if (oldUrl) await this.avatarStorage.delete(oldUrl)  // delete old only after commit
} catch (error) {
  if (newUrl) await this.avatarStorage.delete(newUrl).catch(() => {})  // harvest orphan
  throw error
}
```

**DB-only mutations** (all other UtilisateurService methods and all VehiculeService methods) follow the existing ADR-0012 pattern unchanged: row write + `logAudit(event, tx)` inside `db.transaction`, no filesystem involvement.

### What this does NOT mean

- **This does not re-open ADR-0006's restriction on re-extracting DB ports.** The class shape and constructor-injected `DrizzleDb` stay as decided by Candidate 2's grilling; the fs-ordering principle is orthogonal.
- **This does not change ADR-0011's `logAudit` contract.** The function is called with `tx as any` (matching the existing `any` cast in `lib/societe/index.ts:121` and `lib/demande/mutations.ts:135+241`) and writes inside the transaction. *(Post-adoption annotation: the `tx as any` convention is retired by issue #149 — `DrizzleTransactionClient` types every transaction-aware seam, so `logAudit(event, tx)` is fully typed; this ADR's contract note should be read in the pre-typing context.)*
- **This does not mandate a periodic orphan-cleanup pass.** The rollback-catch harvest is sufficient for the single orphan per rollback scenario. If future cross-boundary mutations produce many orphans per rollback, the architectural decision to add a cleanup pass should be made at that point.

## Rationale

- **Prevents unrecoverable data loss.** The ordering "delete old file only after the new state is committed" ensures that the rollback of a failed transaction does not destroy the old avatar that the committed row still references. A lost avatar is a permanent data loss (the file cannot be reconstructed from the DB); an orphan new file is recoverable (it can be deleted or ignored).
- **Prevents row references to non-existent files.** The ordering "save new file before the transaction opens" ensures that at the moment `tx.update(...).set({ avatarUrl: newUrl })` commits, `newUrl` points at a file that already exists on disk. No row commits before its referenced file is persisted.
- **Rollback-cleanup matches the existing precedent.** ADR-0009's `quitterAmorcage` clears the cache after the atomically committed bootstrap; ADR-0012's `updateSociete` clears the cache after the atomic update. The rollback-cleanup here is the same principle — side-effect after commit, rollback does not leak — applied to filesystem `unlink` instead of cache clear.
- **The orphan harvest cost is bounded.** One `unlink` per rollback that produced a saved new file. No periodic sweep needed. The double `.catch(() => {})` is the exact level of reliability required — an orphan is an orphan whether the cleanup succeeds or not.

## Consequences

- `UtilisatorService.updateProfile`'s avatar branch reorders per the "Before → After" diff above. The change is isolated to a single `if (data.avatarData !== undefined)` branch — it does not touch DB-only mutations.
- `lib/utilisateur-service.test.ts` migration to PGLite includes a rollback test that injects `logAudit` throw and asserts: (i) the Utilisateur row is unchanged, (ii) `avatarStorage.delete` was called with the *new* URL (orphan harvested), (iii) `avatarStorage.delete` was NOT called with the *old* URL (old file untouched despite rollback).
- The empty `catch {}` in `lib/avatar-storage.ts:47-49` (`delete` method) is flagged as a follow-up — same antipattern ADR-0008 and ADR-0012's warn-once resolved for `loadSocieteIdentity` and `getSocieteBranding`. It is not fixed by this ADR; it is an independent pre-existing issue filed as a domain-modeling follow-up.
- Future mutation writers that cross the DB/filesystem boundary should adopt this ordering by convention. Example: if a future `DocumentService.saveAttachment` writes a file and records a Document row, it should save the file before the tx and delete the file only after the tx commits.
- ADR-0007 (transition effects), ADR-0009 (cache-after-commit), ADR-0012 (non-transition atomicity), and this ADR (cross-boundary fs ordering) together form a complete atomicity taxonomy: DB-only writes (0007/0012), in-memory side-effects after commit (0009), and filesystem writes before/after commit (0014).

## Tickets

Two tracer-bullet tickets are filed alongside this ADR via the `/to-tickets` skill. Both implement the decisions above:

- **T1: Utilisateur atomicity + PGLite migration** — implements ADR-0014's fs-ordering fix for `updateProfile` plus ADR-0012's atomicity shape for `create`/`update`/`changePassword`/`updateProfile`; migrates `lib/utilisateur-service.test.ts` to PGLite with atomic-commit and rollback assertions.
- **T2: Vehicule atomicity + PGLite migration** — implements ADR-0012's atomicity shape for `create`/`update`/`delete`; migrates `lib/vehicule-service.test.ts` to PGLite.

Neither blocks the other. Both may land in any order or in parallel.
