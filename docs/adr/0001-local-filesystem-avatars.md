# ADR 0001: Local filesystem for avatar storage

**Date:** 2026-05-22

**Status:** Accepted

## Context

The profile page needs avatar/profile image uploads. There is no existing file upload infrastructure in the app. The options were:

1. **Local filesystem** — save image files to `public/uploads/avatars/`, store the URL path in `Utilisateur.avatarUrl`
2. **Database base64** — store image data directly in a text column
3. **Cloud storage** — S3, Cloudinary, or similar external service

## Decision

Use local filesystem storage (`public/uploads/avatars/`) with the file path stored in `Utilisateur.avatarUrl`.

## Rationale

- **Zero new dependencies** — no cloud SDKs, no storage service setup, no API keys
- **Simple to operate** — files are served directly by Next.js from the `public/` directory; no streaming, no signed URLs
- **Consistent with existing architecture** — the app has no cloud infra; adding it just for avatars is disproportionate
- **Easy to migrate later** — if cloud storage is ever needed, it's a single-file change in the API route; the DB stores a URL string regardless of backend
- **Sufficient for an internal business app** — low traffic, small number of users, no public-facing CDN requirements

## Consequences

- Avatars are not replicated across servers unless a shared filesystem (NFS, etc.) is used in multi-instance deployments
- Migrating to cloud storage later requires moving files and changing the upload route only
- Orphaned files must be cleaned up on avatar replacement (implemented in the upload handler)
