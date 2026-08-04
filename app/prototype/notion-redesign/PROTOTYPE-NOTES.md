# Prototype: Notion-style login and dashboard shell

## Question (wayfinder #171)

How should the login page and the dashboard shell (sidebar, breadcrumb-style
header, list page, form page) look in the approved direction — Notion-inspired,
brand-colored, layout free to change?

## How to run (prototype only)

```bash
npm run dev
```

Navigate to `/prototype/notion-redesign`. Switch surface (Connexion / Liste /
Formulaire) with `?surface=login|liste|formulaire` in the URL — reload-stable
and shareable. Variant A is the only variant left (B/C + switcher deleted in
execution #189).

## Variants tested

| Key | Name             | Structure                                                                                                                                                                                                                                                            |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Notion classique | Faithful app recreation: warm `#F7F6F3` 240px sidebar with section headings + hover-reveal rows, page header inside content (breadcrumb + 40px title + actions), database-style table, flowing page form. Login: centered column, email first, provider row, footer. |
| B   | Marque & cartes  | Brand-led: split-screen login with brand panel + stats, white sidebar with brand active-row bar, sticky breadcrumb top bar, card grid list with filter pills, two-column form with sticky estimation/avance panel.                                                   |
| C   | Document & rail  | Editor-first: minimal underline-input login, 44px icon rail, centered 720px content column, list grouped by Etape as document rows, form as inline property rows with hairline separators.                                                                           |

All variants use the Societe's couleurPrimaire (placeholder `#0F766E` in
`mock-data.ts`) as the accent — swap the constant to try your real brand color.

## Verdict

**Winner: Variant A — Notion classique** (HITL approval on #171, 2026-08-03).

### What it locks (spec for the page-family tickets of map #169)

- **Login**: centered ~380px column, brand logo mark above heading, 14px
  labels, hairline inputs (3px radius, focus ring = 1px couleurPrimaire),
  primary "Continuer" button (couleurPrimaire, hover darken, Notion button
  shadow `0 1px 2px rgba(15,15,15,.1)`), "Ou" divider, full-width provider
  button, footer links.
- **Shell**: 240px warm sidebar `#F7F6F3` with inset 1px `#F0EFED` right
  hairline; 11px uppercase section headings; 28px-high nav rows (14px text,
  hover `rgba(55,53,47,.06)`, active `rgba(0,0,0,.03)` + medium weight);
  hover-reveal chevron on rows; collapse icon top-right; user row at bottom.
- **No top navbar — the page header lives inside the content**: breadcrumb
  row (14px, `#787774`, current part `#37352F` medium) with actions
  top-right (ghost icon buttons + primary action); page icon tile + 40px/700
  title + muted subtitle.
- **List page**: database-style table — muted 60%-ink header row, hairline
  borders (no left/right), row hover `rgba(55,53,47,.024)`, tab filters +
  search input above the table.
- **Form page**: max-width 720px, uppercase section headings with hairline
  rule, 2-col field grid, h-9 inputs, avance checkbox, ghost "Annuler" +
  primary "Enregistrer".
- **Accent = couleurPrimaire** (placeholder `#0F766E` in `mock-data.tsx`).
- **Sidebar width: 240px** — resolves research unknown #2 (240–300px band)
  toward the verified 240px skeleton.

### Cleanup

- The prototype stays as the linked reference asset for the page-family
  tickets (per #171: "Link the prototype as an asset from this issue").
- Variants B/C and the switcher have been deleted (execution #189) once the
  auth pages were folded into the real `/login` page — see
  [Execute: restyle the auth pages](https://github.com/mustaphaelou/deplacementapp/issues/189).
  The `(dashboard)` shell tickets are separate. Do not promote prototype code
  directly — it has no tests and uses mock data.
