# Prototype: Login page redesign (ReUI split-screen)

## Question

What should the login page look like? The user supplied a detailed ReUI-style
split-screen spec (dark brand hero + testimonial carousel + light auth form) —
how does that spec compare against structurally different alternatives before
it gets folded into the real `/login` page?

## How to run (prototype only)

```bash
npm run dev
```

Navigate to `/prototype/login-redesign`. Switch variant with `?variant=A|B|C`
in the URL (reload-stable and shareable) or with the floating bottom bar /
`←` `→` keys (skipped while typing in an input). The switcher is gated to
non-production builds.

## Variants tested

| Key | Name                   | Structure                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Split hero (the spec)  | Faithful spec recreation: dark `#0B0F17` left panel (logo, "Access With Trust", gradient glows, auto-sliding testimonial carousel with elevated white center card + dimmed side cards + dots, Trustpilot "Excellent" + green stars + "Trusted by 14,800+" footer) and white right panel (email or username, password + Forgot link + eye toggle, dark "Sign in", "Or continue with" divider, Google/Apple/GitHub grid, Sign up, © 2026 legal line). Left panel hidden on mobile. |
| B   | Vertical, social-first | Single centered column, no split: dark hero band up top (brand, one featured quote, 3-column trust stats), light form section below. Different hierarchy AND different form ordering — SSO buttons come FIRST, then divider "or use your email", then email/password.                                                                      |
| C   | Inverted split, dark   | 50/50 split flipped: dark glass form on the LEFT (grid pattern + glows, white-on-dark inputs), brand panel on the RIGHT (big wordmark, one big quote with gradient avatar ring, Trustpilot row). Primary affordance differs radically: passwordless "Send magic link" CTA, password field hidden behind a toggle. SSO buttons are icon-only circles. |

All variants share: password show/hide, basic form validation with inline
error messages, ARIA labels/described-by/aria-invalid, mobile stacking.
All are read-only — no real auth wiring (use `@/lib/auth/client` patterns on
the real page).

## Notes

- Copy is the spec's English "ReUI" brand verbatim. When folding into the real
  app, swap in the Societe branding + French copy from
  `app/(auth)/login/page.tsx` (BrandProvider, societe nom/logo, "Continuer").
- The existing approved direction (Notion-style centered column, per
  `app/prototype/notion-redesign/PROTOTYPE-NOTES.md`) is the current baseline
  this spec would replace — worth weighing before committing.
- Do not promote prototype code directly — no tests, mock-only handlers.

## Verdict

PLACEHOLDER — pick a winner (or a mix: e.g. "the split hero of A with the
icon-only SSO of C"), then delete the losing variants + switcher and fold the
winner into `app/(auth)/login`.
