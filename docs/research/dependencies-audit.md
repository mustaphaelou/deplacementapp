# Dependencies Audit — deplacementapp

> Compiled from the npm registry (live `npm view` queries), local `node_modules` ground truth (`npm ls --depth=0`), GitHub release notes/changelogs, and GitHub Security Advisories. Last updated: 2026-08-02.

---

## 1. Method & Version-Check Procedure

| Aspect | Method |
|--------|--------|
| Installed versions | `npm ls --depth=0` against `node_modules` (ground truth for what is installed) |
| Latest published versions | Live npm registry queries — `npm view <pkg> version` and `npm view <pkg> dist-tags --json` for every direct dependency (48 packages). Registry was reachable. |
| Breaking-change research | Primary sources: GitHub releases/changelogs, official migration guides, GitHub Security Advisories (GHSA) |
| Security | `npm audit --json` (read-only) |

Package counts: **48 direct packages** (24 `dependencies` + 24 `devDependencies`). Status summary:

- **Up to date (installed == latest): 28**
- **Minor behind: 7** | **Patch behind: 7** (14 non-major behind total)
- **Major behind: 5** (`nodemailer`, `eslint`, `js-yaml`, `typescript`, `@types/bcryptjs`)
- **Broken install state: 1** (`@types/js-yaml` missing, `js-yaml` mismatch)

---

## 2. Node.js Version Story

| Source | Version |
|--------|---------|
| Local runtime (`node --version`) | **v24.18.0** |
| `Dockerfile` base image | `node:24-alpine` (all stages) |
| `.nvmrc` | none |
| `engines` field in `package.json` | none |

All major upgrades are Node-24 compatible:

| Package (latest) | `engines` requirement | Compatible with Node 24? |
|------------------|----------------------|--------------------------|
| `next@16.2.12` | `>=20.9.0` ([npm](https://registry.npmjs.org/next)) | ✅ |
| `eslint@10.8.0` | `^20.19.0 \|\| ^22.13.0 \|\| >=24` ([npm](https://registry.npmjs.org/eslint)) | ✅ |
| `typescript@7.0.2` | `>=16.20.0` ([npm](https://registry.npmjs.org/typescript)) | ✅ |
| `nodemailer@9.0.3` | `>=6.0.0` ([npm](https://registry.npmjs.org/nodemailer)) | ✅ |

Note for TS7: the Go-native compiler is a compiled binary; on Alpine it needs `libc6-compat` — the Dockerfile `build-env` stage already installs it ([Dockerfile](/config/workspace/deplacementapp/Dockerfile)). `tsc` runs only at build time, not in the runner image.

---

## 3. Full Dependency Table

### 3.1 `dependencies` (runtime)

| Package | Declared | Installed | Latest | Status | Usage in this app | Notes |
|---------|----------|-----------|--------|--------|-------------------|-------|
| `@base-ui/react` | `^1.6.0` | 1.6.0 | 1.6.0 ([npm](https://registry.npmjs.org/@base-ui/react)) | ✅ up to date | Unstyled primitives in `components/ui/dialog.tsx`, `select.tsx` | — |
| `@hookform/resolvers` | `^5.4.0` | 5.4.0 | 5.7.1 ([npm](https://registry.npmjs.org/@hookform/resolvers)) | 🔶 minor behind | Zod resolver in `components/demande-form.tsx`, `setup-wizard.tsx` | Patch/minor bug fixes only |
| `@hugeicons/core-free-icons` | `^4.2.3` | 4.2.3 | 4.2.3 ([npm](https://registry.npmjs.org/@hugeicons/core-free-icons)) | ✅ up to date | **Not imported anywhere in app code** | Unused — removal candidate |
| `@hugeicons/react` | `^1.1.9` | 1.1.9 | 1.1.9 ([npm](https://registry.npmjs.org/@hugeicons/react)) | ✅ up to date | **Not imported anywhere in app code** | Unused — removal candidate |
| `@react-pdf/renderer` | `^4.5.1` | 4.5.1 | 4.5.1 ([npm](https://registry.npmjs.org/@react-pdf/renderer)) | ✅ up to date | PDF generation in `components/pdf/travel-request-pdf.tsx` | — |
| `bcryptjs` | `^3.0.3` | 3.0.3 | 3.0.3 ([npm](https://registry.npmjs.org/bcryptjs)) | ✅ up to date | Password hashing in `lib/auth/session.ts`, `lib/amorcage.ts` | Ships its own types since 3.x |
| `class-variance-authority` | `^0.7.1` | 0.7.1 | 0.7.1 ([npm](https://registry.npmjs.org/class-variance-authority)) | ✅ up to date | `components/ui/button.tsx`, `empty.tsx` | — |
| `clsx` | `^2.1.1` | 2.1.1 | 2.1.1 ([npm](https://registry.npmjs.org/clsx)) | ✅ up to date | cn() helper, UI components | — |
| `date-fns` | `^4.4.0` | 4.4.0 | 4.4.0 ([npm](https://registry.npmjs.org/date-fns)) | ✅ up to date | `components/ui/date-range-picker.tsx` | — |
| `drizzle-orm` | `^0.43.1` | 0.43.1 | 0.45.2 ([npm](https://registry.npmjs.org/drizzle-orm)) | 🔴 security | DB layer — `db/index.ts` (`drizzle-orm/node-postgres`), `db/schema/**`, queries throughout | **HIGH severity SQLi fix in 0.45.2 — see §4.4** |
| `lucide-react` | `^1.26.0` | 1.26.0 | 1.28.0 ([npm](https://registry.npmjs.org/lucide-react)) | 🔶 minor behind | Icons in `components/sidebar.tsx`, `demande-detail.tsx`, etc. | Icon set additions |
| `next` | `16.2.11` (exact) | 16.2.11 | 16.2.12 ([npm](https://registry.npmjs.org/next)) | 🔶 patch behind | Framework | 16.2.12 is a patch; note 16.3.0 fixes bundled postcss/sharp vulns — see §4.1 |
| `next-auth` | `^5.0.0-beta.32` | 5.0.0-beta.32 | beta.32 (latest beta) / 4.24.15 (latest stable) ([npm dist-tags](https://registry.npmjs.org/next-auth)) | ⚠️ beta noted | Auth — `app/api/auth/**`, `lib/auth/*` | **No stable v5 release yet — see §4.8** |
| `next-themes` | `^0.4.6` | 0.4.6 | 0.4.6 ([npm](https://registry.npmjs.org/next-themes)) | ✅ up to date | `components/theme-provider.tsx` | — |
| `nodemailer` | `^7.0.13` | 7.0.13 | 9.0.3 ([npm](https://registry.npmjs.org/nodemailer)) | 🔴 major behind + security | SMTP in `lib/email-transporter.ts` (plain user/pass SMTP) | **HIGH severity advisories; v9 blocked by next-auth peer range — see §4.5** |
| `pg` | `^8.22.0` | 8.22.0 | 8.22.0 ([npm](https://registry.npmjs.org/pg)) | ✅ up to date | Postgres driver — `db/index.ts` | — |
| `react` | `^19.2.8` | 19.2.8 | 19.2.8 ([npm](https://registry.npmjs.org/react)) | ✅ up to date | UI | — |
| `react-day-picker` | `^10.0.1` | 10.0.1 | 10.0.1 ([npm](https://registry.npmjs.org/react-day-picker)) | ✅ up to date | `components/ui/date-range-picker.tsx` | — |
| `react-dom` | `^19.2.8` | 19.2.8 | 19.2.8 ([npm](https://registry.npmjs.org/react-dom)) | ✅ up to date | UI | — |
| `react-hook-form` | `^7.82.0` | 7.82.0 | 7.84.0 ([npm](https://registry.npmjs.org/react-hook-form)) | 🔶 minor behind | Forms — `demande-form.tsx`, `setup-wizard.tsx` | Patch/minor fixes |
| `sonner` | `^2.0.7` | 2.0.7 | 2.0.7 ([npm](https://registry.npmjs.org/sonner)) | ✅ up to date | Toasts — `app/layout.tsx` | — |
| `tailwind-merge` | `^3.6.0` | 3.6.0 | 3.6.0 ([npm](https://registry.npmjs.org/tailwind-merge)) | ✅ up to date | cn() helper | — |
| `tw-animate-css` | `^1.4.0` | 1.4.0 | 1.4.0 ([npm](https://registry.npmjs.org/tw-animate-css)) | ✅ up to date | `app/globals.css` | — |
| `zod` | `^4.4.3` | 4.4.3 | 4.4.3 ([npm](https://registry.npmjs.org/zod)) | ✅ up to date | Validation — `lib/schemas.ts`, `lib/api-utils.ts`, forms | — |

### 3.2 `devDependencies`

| Package | Declared | Installed | Latest | Status | Usage in this app | Notes |
|---------|----------|-----------|--------|--------|-------------------|-------|
| `@ai-hero/sandcastle` | `^0.12.0` | 0.12.0 | 0.12.0 ([npm](https://registry.npmjs.org/@ai-hero/sandcastle)) | ✅ up to date | `.sandcastle/main.ts` (sandcastle script) | — |
| `@electric-sql/pglite` | `^0.5.4` | 0.5.4 | 0.5.4 ([npm](https://registry.npmjs.org/@electric-sql/pglite)) | ✅ up to date | In-process Postgres for tests — `lib/test/create-pglite-db.ts` | — |
| `@eslint/eslintrc` | `^3` | 3.3.6 | 3.3.6 ([npm](https://registry.npmjs.org/@eslint/eslintrc)) | ✅ up to date | ESLint flat-config support | — |
| `@tailwindcss/postcss` | `^4.3.3` | 4.3.3 | 4.3.3 ([npm](https://registry.npmjs.org/@tailwindcss/postcss)) | ✅ up to date | Tailwind 4 PostCSS plugin | — |
| `@types/bcryptjs` | `^2.4.6` | 2.4.6 | 3.0.0 ([npm](https://registry.npmjs.org/@types/bcryptjs)) | 🔴 major behind + **DEPRECATED** | — | **Remove**: "bcryptjs provides its own type definitions" ([npm](https://www.npmjs.com/package/@types/bcryptjs)) |
| `@types/js-yaml` | `^4.0.9` | **missing** | 4.0.9 ([npm](https://registry.npmjs.org/@types/js-yaml)) | ⚠️ broken install | — | **Not installed** despite being declared + in lockfile — see §5.3 |
| `@types/node` | `^25.9.5` | 25.9.5 | 26.1.2 ([npm](https://registry.npmjs.org/@types/node)) | 🔶 minor behind | Node type defs | — |
| `@types/nodemailer` | `^8.0.1` | 8.0.1 | 8.0.1 ([npm](https://registry.npmjs.org/@types/nodemailer)) | ✅ up to date | — | Note: types lag nodemailer (v8 vs v9 latest) |
| `@types/pg` | `^8.20.0` | 8.20.0 | 8.20.3 ([npm](https://registry.npmjs.org/@types/pg)) | 🔶 patch behind | — | — |
| `@types/react` | `^19.2.17` | 19.2.17 | 19.2.18 ([npm](https://registry.npmjs.org/@types/react)) | 🔶 patch behind | — | — |
| `@types/react-dom` | `^19.2.3` | 19.2.3 | 19.2.4 ([npm](https://registry.npmjs.org/@types/react-dom)) | 🔶 patch behind | — | — |
| `@vitest/coverage-v8` | `^4.1.10` | 4.1.10 | 4.1.10 ([npm](https://registry.npmjs.org/@vitest/coverage-v8)) | ✅ up to date | Coverage | — |
| `drizzle-kit` | `^0.30.6` | 0.30.6 | 0.31.10 ([npm](https://registry.npmjs.org/drizzle-kit)) | 🔶 minor behind + security | `drizzle:generate/migrate/push/studio`, `postinstall` | Fixes moderate esbuild dev-server vuln — see §4.4 |
| `eslint` | `^9.39.5` | 9.39.5 | 10.8.0 ([npm](https://registry.npmjs.org/eslint)) | 🔴 major behind | `npm run lint` | **v9 EOL 2026-08-06 — see §4.6** |
| `eslint-config-next` | `16.2.11` (exact) | 16.2.11 | 16.2.12 ([npm](https://registry.npmjs.org/eslint-config-next)) | 🔶 patch behind | `eslint.config.mjs` | Must move in lockstep with `next` |
| `js-yaml` | `^4.3.1` | **4.3.0 (invalid)** | 5.2.3 ([npm](https://registry.npmjs.org/js-yaml)) | 🔴 major behind | `scripts/publish-gate.test.ts` (test only) | Installed 4.3.0 does **not** satisfy `^4.3.1`; v5 is a TS rewrite — see §4.7 |
| `postcss` | `^8` | 8.5.22 | 8.5.25 ([npm](https://registry.npmjs.org/postcss)) | 🔶 patch behind | `postcss.config.mjs` | Installed 8.5.22 already past the advisory ranges (<8.5.10 / ≤8.5.11) |
| `prettier` | `^3.9.6` | 3.9.6 | 3.9.6 ([npm](https://registry.npmjs.org/prettier)) | ✅ up to date | `npm run format` | — |
| `prettier-plugin-tailwindcss` | `^0.8.1` | 0.8.1 | 0.8.1 ([npm](https://registry.npmjs.org/prettier-plugin-tailwindcss)) | ✅ up to date | — | — |
| `shadcn` | `^4.14.0` | 4.14.0 | 4.16.1 ([npm](https://registry.npmjs.org/shadcn)) | 🔶 minor behind | CLI for UI components (`components.json`) | — |
| `tailwindcss` | `^4.3.3` | 4.3.3 | 4.3.3 ([npm](https://registry.npmjs.org/tailwindcss)) | ✅ up to date | Styling | — |
| `tsx` | `^4.23.1` | 4.23.1 | 4.23.2 ([npm](https://registry.npmjs.org/tsx)) | 🔶 patch behind | `sandcastle` script runner | — |
| `typescript` | `^5.9.3` | 5.9.3 | 7.0.2 ([npm](https://registry.npmjs.org/typescript)) | 🔴 major behind | `npm run typecheck` (`tsc --noEmit`) | **v7 is the Go-native compiler; blocked by typescript-eslint peer range — see §4.7** |
| `vitest` | `^4.1.10` | 4.1.10 | 4.1.10 ([npm](https://registry.npmjs.org/vitest)) | ✅ up to date | `npm test` | — |

---

## 4. Major-Change Deep Dives

### 4.1 `next` 16.2.11 → 16.2.12 (patch) and the 16.3.0 security milestone

- 16.2.12 is a routine patch (published 2026-07-25, [releases](https://github.com/vercel/next.js/releases)). Safe bump.
- **But** all current 16.2.x releases bundle `postcss@8.4.31` ([npm dependency data](https://registry.npmjs.org/next)) and `sharp@^0.34.5`, both of which have open advisories:
  - PostCSS: XSS via unescaped `</style>` (GHSA-qx2v-qp2m-jg93), arbitrary file read via `sourceMappingURL` (GHSA-6g55-p6wh-862q) — fixed in postcss 8.5.10+/8.5.12+ ([advisories](https://github.com/advisories?query=postcss)).
  - sharp: libvips CVEs CVE-2026-33327/33328/35590/35591 (GHSA-f88m-g3jw-g9cj) — fixed in sharp ≥0.35.0.
- The fixes land in the **16.3.0** line: canary PR [#96107 "Bump postcss to 8.5.23"](https://github.com/vercel/next.js/pull/96107); `16.3.0-preview.10` already carries `postcss@8.5.10` + `sharp@^0.35.3` ([npm](https://registry.npmjs.org/next)). 16.3.0 is currently in preview (16.3.0-preview.10), no stable yet.
- **Impact:** app has no code changes needed; the vulnerability is in the build/dev pipeline (postcss is used at build time). Watch for 16.3.0 stable and take the bump when it lands.

### 4.2 `react` / `react-dom` 19.2.8 — up to date

Both at latest ([npm](https://registry.npmjs.org/react)). Next 16.3 canaries are upgrading React snapshots internally ([releases](https://github.com/vercel/next.js/releases)) — no action.

### 4.3 `tailwindcss` 4.3.3, `vitest` 4.1.10, `zod` 4.4.3, `react-hook-form`, `lucide-react`, `date-fns` — current or minor

- `tailwindcss@4.3.3` + `@tailwindcss/postcss@4.3.3`: latest. `prettier-plugin-tailwindcss@0.8.1`: latest. No action.
- `vitest@4.1.10` + `@vitest/coverage-v8@4.1.10`: latest. No action.
- `zod@4.4.3`: latest (v4 stable line). No action.
- `react-hook-form@7.82.0 → 7.84.0`, `@hookform/resolvers@5.4.0 → 5.7.1`, `lucide-react@1.26.0 → 1.28.0`, `date-fns@4.4.0`: minor-range updates, backward compatible.

### 4.4 `drizzle-orm` 0.43.1 → 0.45.2 and `drizzle-kit` 0.30.6 → 0.31.10 — SECURITY

- **drizzle-orm 0.45.2 fixes a HIGH-severity SQL injection** (GHSA-gpj5-g38j-94v9, CWE-89): `sql.identifier()` / `sql.as()` did not properly escape values. Fixed in the 0.45.2 patch (2026-03-27, [release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.2)). `npm audit` reports the installed 0.43.1 as vulnerable; fix available at 0.45.2.
- 0.44.x/0.45.x are additive 0.x releases; no migration guide needed for this bump (0.x rules still apply — run the test suite).
- **drizzle-kit 0.31.10** fixes a moderate advisory via its `esbuild` dev-server dependency (GHSA — esbuild dev server request exfiltration), also adds migration-commutativity improvements ([changelog](https://github.com/drizzle-team/drizzle-orm/releases)). `npm audit` marks the fix as a semver-major (0.30→0.31).
- **Note:** Drizzle 1.0.0 is in release-candidate (1.0.0-rc.4, 2026-06-27) with breaking changes (new `snakeCase`/`camelCase` casing API, codec system, JIT mappers, RQBv1 removal, drizzle-kit JSON output modes, [rc notes](https://github.com/drizzle-team/drizzle-orm/releases)). Not required now — the 0.45.2 stable patch covers the vulnerability.

### 4.5 `nodemailer` 7.0.13 → 9.0.3 (two majors) — SECURITY + peer-dependency blocker

- The installed 7.0.13 is affected by **several SMTP injection / SSRF / TLS advisories**, the most severe being GHSA-p6gq-j5cr-w38f (high: `raw` option bypasses file/URL access restrictions → arbitrary file read + SSRF) fixed in **9.0.1**, and others fixed across 8.0.4–8.0.9 ([changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)).
- Breaking changes on the path:
  - 7→8 (2026-02-04): error code `NoAuth` renamed to `ENOAUTH` ([changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)).
  - 8→9 (2026-06-14): TLS certificate validation **now enforced by default** when fetching remote content / OAuth2 token endpoints / proxy CONNECT; opt-out via `tls.rejectUnauthorized` ([changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)).
- **App impact is minimal**: `lib/email-transporter.ts` uses plain SMTP with user/pass (no OAuth2, no URL attachments), so the v9 TLS change doesn't apply. The `ENOAUTH` rename is only relevant if code inspects that error code.
- ⚠️ **Blocker for v9**: `next-auth@5.0.0-beta.32` declares peer dependency `nodemailer: "^7.0.7 || ^8.0.5"` ([npm](https://registry.npmjs.org/next-auth)). **9.0.x does not satisfy this range.** Safe target today: **8.0.11** (all 8.0.x advisories fixed by 8.0.9). v9 needs a next-auth update or an `overrides` entry (not recommended without testing).

### 4.6 `eslint` 9.39.5 → 10.8.0 — MAJOR, and **v9 EOL is 2026-08-06**

- ESLint announced v10 on 2026-02-06 and set **v9 end-of-life for 2026-08-06** ([release post](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)) — four days from this audit's date. 9.39.5 is the final v9 release.
- v10 breaking changes ([migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)): flat config mandatory (legacy `.eslintrc` removed), new config-file lookup algorithm (from each linted file), JSX references now tracked (can surface new errors), updated `eslint:recommended`, `eslint-env` comments error, Node ≥20.19.
- **App impact is low**: `eslint.config.mjs` is already flat config ([file](/config/workspace/deplacementapp/eslint.config.mjs)); Node 24 satisfies engines; official codemods exist (`npx codemod @eslint/v9-to-v10`). Plan for: possible new JSX-tracking violations; `eslint-config-next@16.2.12` peer is `eslint >=9.0.0` so v10 is allowed ([npm](https://registry.npmjs.org/eslint-config-next)).

### 4.7 `typescript` 5.9.3 → 7.0.2 — MAJOR (Go-native rewrite) + `js-yaml` 4 → 5

**TypeScript 7.0** (stable 2026-07-08) is the native Go port ("Project Corsa") of the compiler — ~8–12× faster full builds, identical type semantics to TS 6.0 ([announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)). Relevant breaking changes: previously-deprecated options become **hard errors** (`target: es5`, `baseUrl`, `moduleResolution: node`, …); new defaults (`strict` on by default, `module: esnext`); no stable programmatic compiler API on day one ([TS7 RC notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/), [migration write-ups](https://www.developersdigest.tech/blog/typescript-7-native-compiler-migration-guide)).

- ⚠️ **Blocker**: `typescript-eslint` (bundled by `eslint-config-next` via `typescript-eslint@^8.46.0`) declares peer `typescript: ">=4.8.4 <6.1.0"` ([npm](https://registry.npmjs.org/@typescript-eslint/eslint-plugin)). **TypeScript 7.0.2 does not satisfy it** → `npm run lint` breaks on TS 7.
- Recommended path: **5.9.3 → 6.0.x first** (last JS-based line, 2026-03-23, [announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)), then to 7.0 once typescript-eslint publishes support.
- This app's tsconfig already uses `moduleResolution: "bundler"`, `module: "esnext"` — compatible. But `baseUrl: "."` is used ([tsconfig.json](/config/workspace/deplacementapp/tsconfig.json)) and **becomes a hard error in TS 7** → must switch to root-relative `paths` (`"@/*": ["./*"]` → `["../*"]`-style relative to config location or drop `baseUrl`).

**js-yaml 4 → 5** (v5.0.0, 2026-06-20; latest 5.2.3): rewritten in TypeScript with flat named exports; breaking: `safeLoad/safeDump` removed, `load()` throws on empty input, `!!set` loads as `Set`, custom `Type` API replaced by tag functions, several dumper options renamed/removed ([changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md), [v4→v5 migration guide](https://github.com/nodeca/js-yaml/blob/master/docs/migrate_v4_to_v5.md)). v5 ships its own types — `@types/js-yaml` becomes unnecessary. App usage is limited to `scripts/publish-gate.test.ts` (default `yaml` import), so migration surface is tiny.

### 4.8 `next-auth` — the v5 beta situation

- **There is still no stable v5.** Latest `beta` dist-tag is `5.0.0-beta.32` (published 2026-07-20), which is exactly what the app pins ([npm dist-tags](https://registry.npmjs.org/next-auth)). Latest stable is v4.24.15.
- The app is **on the newest available version of the v5 line** — nothing to update; staying on beta.32 is the correct posture for a Next 16 app (v4 does not support Next 15/16 peer ranges; v5's peers cover `next ^14 || ^15 || ^16`, `react ^18.2 || ^19` ([npm](https://registry.npmjs.org/next-auth))). Just be aware of the nodemailer peer constraint from §4.5 and monitor [next-auth releases](https://github.com/nextauthjs/next-auth/releases) for a stable v5.

---

## 5. Security Audit (`npm audit --json`, 2026-08-02)

**17 advisories total (0 critical, 8 high, 7 moderate, 2 low).** Direct dependencies affected: **4**.

| Direct package | Severity | Advisory | Fix version |
|----------------|----------|----------|-------------|
| `drizzle-orm@0.43.1` | **high** | SQL injection via improperly escaped SQL identifiers — [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9) | 0.45.2 |
| `nodemailer@7.0.13` | **high** | Message-level `raw` option bypass → arbitrary file read / SSRF — [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) (+ 5 more advisories ≤8.0.x) | 9.0.3 (≥8.0.9 covers most; 9.0.1 the high one) |
| `next@16.2.11` | **high** | Inherited from bundled `postcss@8.4.31` (GHSA-6g55-p6wh-862q etc.) and `sharp@^0.34.5` (GHSA-f88m-g3jw-g9cj) | next 16.3.0 (postcss 8.5.23 bump, [PR #96107](https://github.com/vercel/next.js/pull/96107)) |
| `drizzle-kit@0.30.6` | moderate | esbuild dev-server request exfiltration (via `@esbuild-kit/*`) | 0.31.10 |

All other 13 advisories are transitive (hono/@modelcontextprotocol-sdk, brace-expansion, fast-uri, sharp, postcss, body-parser, qs, esbuild, @babel/core) and have no direct fix path here (mostly fixed by the four upgrades above; some are dev-only).

## 6. Deprecated / Unused / Install-State Issues

| Item | Issue | Recommendation |
|------|-------|----------------|
| `@types/bcryptjs` | **Deprecated**: "bcryptjs provides its own type definitions" ([npm](https://www.npmjs.com/package/@types/bcryptjs)) | Remove from devDependencies |
| `@hugeicons/core-free-icons`, `@hugeicons/react` | Not imported anywhere in app code (only in `package.json` + `components.json`) | Remove (icons switched to `lucide-react`) |
| `@types/js-yaml` | Declared `^4.0.9` but **missing from node_modules** (`npm ls` reports UNMET DEPENDENCY); present in lockfile | Reinstall fixes it (`npm ci`); may drop it entirely if moving to js-yaml v5 (ships own types) |
| `js-yaml` | Installed 4.3.0, declared `^4.3.1` — **does not satisfy** the range (`npm ls` reports invalid) | Lockfile resolves 4.3.1; `npm ci` restores consistency |
| Root cause | package-lock.json is out of sync with node_modules (partial/inconsistent install) | Run `npm ci` before any of the above updates |

## 7. Prioritized Recommendations

### P0 — Security fixes, safe to do immediately
1. **`drizzle-orm` 0.43.1 → 0.45.2** — HIGH SQLi fix (GHSA-gpj5-g38j-94v9). 0.x bump; run tests. ([npm](https://registry.npmjs.org/drizzle-orm))
2. **`drizzle-kit` 0.30.6 → 0.31.10** — moderate esbuild dev-server fix. ([npm](https://registry.npmjs.org/drizzle-kit))
3. **`nodemailer` 7.0.13 → 8.0.11** — clears 6 advisories incl. the high SSRF one (9.0.1+). v9.0.3 is the eventual target but is blocked by next-auth's peer range (`^7.0.7 || ^8.0.5`); TLS-default change is not relevant to this app's SMTP-only usage. ([npm](https://registry.npmjs.org/nodemailer))
4. **`next` 16.2.11 → 16.2.12** — routine patch; the bundled postcss/sharp advisories only clear in **16.3.0** (currently preview) — schedule that separately. ([releases](https://github.com/vercel/next.js/releases))

### P1 — Time-sensitive / easy wins
5. **`eslint` 9.39.5 → 10.x** — **v9 EOL 2026-08-06** (4 days out). Flat config already in place; run `npx codemod @eslint/v9-to-v10`; expect possible new JSX-tracking violations. ([migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0))
6. **`eslint-config-next` 16.2.11 → 16.2.12** — must move with `next`. ([npm](https://registry.npmjs.org/eslint-config-next))
7. Patch bumps: `@types/react` 19.2.18, `@types/react-dom` 19.2.4, `@types/pg` 8.20.3, `@types/node` 26.1.2, `postcss` 8.5.25, `tsx` 4.23.2.
8. **`npm ci`** to repair the broken install state (missing `@types/js-yaml`, invalid `js-yaml@4.3.0`).

### P2 — Housekeeping
9. Remove `@types/bcryptjs` (deprecated), `@hugeicons/core-free-icons` + `@hugeicons/react` (unused).
10. Minor bumps: `lucide-react` 1.28.0, `react-hook-form` 7.84.0, `@hookform/resolvers` 5.7.1, `shadcn` 4.16.1.

### P3 — Majors needing planning
11. **`typescript` → 6.0.x now, 7.0.x later** — TS 7 is a hard **blocker** for lint (typescript-eslint peer `>=4.8.4 <6.1.0`); also requires dropping `baseUrl` from tsconfig (hard error in TS7). Upgrade TS6 first, then TS7 once typescript-eslint supports it. ([TS7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/))
12. **`js-yaml` → 5.x** — small surface (one test file); breaking API (flat exports, `load()` on empty input); drop `@types/js-yaml`. ([changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md))
13. **`next` 16.3.0** — clears the postcss/sharp advisories (watch for stable). ([releases](https://github.com/vercel/next.js/releases))
14. **`nodemailer` → 9.0.3** — after next-auth loosens its peer range; low code risk for this app.
15. **Drizzle 1.0.0** (currently rc.4) — breaking (casing API, codec/JIT changes); not urgent since 0.45.2 covers the security fix. ([releases](https://github.com/drizzle-team/drizzle-orm/releases))

### Blockers
- **TS 7**: typescript-eslint peer range `<6.1.0` → lint breaks; tsconfig `baseUrl` removal required.
- **nodemailer 9**: next-auth peer range `^7.0.7 || ^8.0.5` → ERESOLVE without override.
- **next postcss/sharp**: no fixed release before 16.3.0 stable.
- **next-auth v5**: still beta (beta.32 = latest); nothing newer exists; do not downgrade to v4 (incompatible with Next 16 peers).

---

## 8. Methodology Notes / Limitations

- Version data was taken live from the npm registry (`npm view` per package) on 2026-08-02; registry access was available, so no fallback (`registry.npmjs.org/<pkg>/latest` fetch) was needed.
- Installed-version ground truth comes from `node_modules` via `npm ls --depth=0`; `npm audit --json` was read-only.
- Release dates: `next@16.2.12` 2026-07-25, `next-auth@5.0.0-beta.32` 2026-07-20, `drizzle-orm@0.45.2` 2026-03-27, `nodemailer@9.0.3` 2026-06-30, `eslint@10.8.0` 2026-07-24, `typescript@7.0.2` 2026-07-08, `js-yaml@5.2.3` 2026-08-01 (npm registry `time` data).
- Not covered: transitive dependency tree (beyond audit impact), runtime behavior after upgrades (requires executing builds/tests — out of scope for a read-only audit).
