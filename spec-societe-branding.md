## Problem Statement

The app currently displays hardcoded branding ("HAY 2010 SARL", "H" logo, and "noreply@hay2010.ma") throughout the UI and email communications. Every deployer of this open-source app sees the same placeholder identity. There is no way to configure the app's name, logo, or visual identity without editing source code.

Deployers need to present the app under their own company identity — their name, their logo, their colours — both in the UI and in outbound communications like emails and PDFs.

## Solution

Introduce a **Societe** entity as the root tenant of each deployment. A single Societe is created during Amorçage (the initial setup wizard). The Societe holds all branding configuration: display name, logo, favicon, primary colour, email sender name, and email domain. These values flow into the UI (sidebar, login page, navbar) and into the email service. Branding can be changed at any time via an administration settings page; changes are recorded in JournalAudit.

## User Stories

1. As a deployer, I want to enter my company name during initial setup, so that the app immediately shows my identity instead of a placeholder.

2. As a deployer, I want to upload a logo during or after setup, so that my company brand appears in the sidebar and login page.

3. As a deployer, I want to set a primary colour, so that the app theme matches my brand guidelines.

4. As a deployer, I want to upload a favicon, so that the browser tab reflects my brand.

5. As a deployer, I want to configure the email sender name (e.g. "Acme Corp" instead of placeholder), so that recipients recognise my company in their inbox.

6. As a deployer, I want to configure the email sender domain (e.g. "acme.com" producing noreply@acme.com), so that outgoing emails use my company's domain.

7. As a deployer, I want to change any of these branding settings after initial setup, so that I can update my identity without redeploying.

8. As a FINANCE_ADMIN, I want a dedicated settings page to manage the Societe's branding, so that I can control the visual identity without developer intervention.

9. As an auditor, I want all branding changes logged in JournalAudit, so that I can track who changed what and when.

10. As an employee, I want to see my company's name and logo in the sidebar and login page, so that the app feels like a company tool rather than a generic platform.

11. As an employee, I want emails from the system to show my company's name and domain, so that I trust the email as legitimate.

12. As a developer maintaining the open-source project, I want all hardcoded branding references removed from source, so that new deployers are not confused by placeholder values.

13. As a developer, I want the Societe model to carry a societeId on Utilisateur and Departement, so that multi-tenant scoping is straightforward when needed later.

## Implementation Decisions

### Societe model (Prisma)

A singleton-style table with a fixed ID of "default" — since each deployment serves exactly one Societe, there is no need for generated IDs. The table carries:

- **nom** (required) — display name
- **logoUrl**, **faviconUrl** (nullable) — filesystem paths, same pattern as AvatarProfil
- **couleurPrimaire** (nullable) — hex colour string
- **nomExpediteurEmail** (nullable) — human-readable sender name for emails
- **domaineEmail** (nullable) — domain part used to build noreply@{domaine}

### Multi-tenant readiness

societeId was added to **Utilisateur** (required) and **Departement** (required, with a compound unique constraint on `[nom, societeId]`). The relationship is wired but other entities (DemandeDeplacement, VehiculeEntreprise, Notification, Document, JournalAudit) remain unscoped — full multi-tenant can be layered on later by adding societeId to each and including it in queries.

### Setup wizard (Amorçage)

The original 2-step wizard (departments → admin user) became a 3-step wizard:

1. **Société info** — name (required), email domain (optional)
2. **Departments** — unchanged
3. **Admin account** — unchanged

### Branding settings page

A new administration page at `/administration/societe` exposes a form with fields for name, primary colour (with live preview swatch), email sender name, and email domain. The logo and favicon URL fields are stored but have no upload UI yet — the existing avatar upload pattern (filesystem + URL in DB) is the intended path.

### Email service

The EmailService now queries the Societe at send-time for the sender name and domain. If found, it constructs the from header dynamically; if not, it falls back to SMTP_FROM env var.

### Audit logging

The PATCH /api/societe route logs every update to JournalAudit with action `MODIFIER_SOCIETE` and a details object listing which fields changed.

## Testing Decisions

- Tests verify external behaviour only (HTTP status codes, response bodies, side-effect calls), not implementation internals.
- The highest testing seam is the API route level (Next.js App Router route handlers).
- Existing patterns to follow: route tests that mock Prisma via vi.mock and assert on response status + body + call signatures (see `app/api/setup/register/route.test.ts` and `app/api/setup/status/route.test.ts`).

### Seams

| Seam | What it covers | Status |
|---|---|---|
| `GET /api/societe` | Returns Societe branding JSON; 404 when none exists | Needs test |
| `PATCH /api/societe` | Updates branding fields; returns updated payload; logs to JournalAudit; rejects unauthorised requests | Needs test |
| `GET /api/setup/status` | Detects Amorçage by Societe.count() instead of Utilisateur.count() | Already tested |
| `POST /api/setup/register` | Creates Societe first, then departments, then user; rejects duplicate setup | Already tested |
| Email service | Picks up dynamic sender name/domain | Testable at route level through PATCH → subsequent email call |

## Out of Scope

- Logo and favicon file upload UI — the DB fields and filesystem pattern exist (following AvatarProfil precedent) but the upload widget is not yet built.
- Full multi-tenant scoping on DemandeDeplacement, VehiculeEntreprise, Notification, Document, and JournalAudit — only Utilisateur and Departement carry societeId for now.
- Theme/primary colour application — the colour value is stored but not yet wired into CSS custom properties or Tailwind config.
- PDF branding — generated PDFs do not yet include Societe name/logo (they use the same snapshot approach as employee data, but the branding fields are not in the PDF template).
- Email template branding — emails do not yet include Societe logo or colour styling.

## Further Notes

- ADR-0001 (local filesystem for avatars) applies by analogy — logo and favicon should follow the same local-filesystem + URL-path pattern used for AvatarProfil.
- The Societe ID is always "default" — this is safe because the app is single-tenant. A future multi-tenant migration would replace the fixed ID with generated IDs and add societeId to the remaining entities.