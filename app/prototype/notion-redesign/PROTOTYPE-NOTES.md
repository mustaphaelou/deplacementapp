# Prototype: Notion-style login and dashboard shell

## Question (wayfinder #171)

How should the login page and the dashboard shell (sidebar, breadcrumb-style
header, list page, form page) look in the approved direction — Notion-inspired,
brand-colored, layout free to change?

## How to run (prototype only)

```bash
npm run dev
```

Navigate to `/prototype/notion-redesign`. Flip variants with the floating
bottom bar or the `←` / `→` arrow keys; switch surface (Connexion / Liste /
Formulaire) with the segmented control. State is in the URL:
`?variant=A&surface=login` — reload-stable and shareable.

## Variants tested

| Key | Name             | Structure                                                                                                                                                                                                                                                            |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Notion classique | Faithful app recreation: warm `#F7F6F3` 240px sidebar with section headings + hover-reveal rows, page header inside content (breadcrumb + 40px title + actions), database-style table, flowing page form. Login: centered column, email first, provider row, footer. |
| B   | Marque & cartes  | Brand-led: split-screen login with brand panel + stats, white sidebar with brand active-row bar, sticky breadcrumb top bar, card grid list with filter pills, two-column form with sticky estimation/avance panel.                                                   |
| C   | Document & rail  | Editor-first: minimal underline-input login, 44px icon rail, centered 720px content column, list grouped by Etape as document rows, form as inline property rows with hairline separators.                                                                           |

All variants use the Societe's couleurPrimaire (placeholder `#0F766E` in
`mock-data.ts`) as the accent — swap the constant to try your real brand color.

## Verdict

**Pending — HITL ticket.** User reacts to the variants; the winning variant
(and the shell decisions it locks) becomes the spec for the page-family
tickets of map #169. Record the verdict here, then:

- Fold the winning variant into the real `/login` page and `(dashboard)` shell
  (rewritten properly — no tests/error-handling here, this is throwaway).
- Delete the losing variants, the switcher, and this route.
